import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResponse } from '../models/auth.model';


const TOKEN_KEY = 'sd_token';
const ROLE_KEY = 'sd_role';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signals hold the current auth state reactively, seeded from localStorage
  // so a page refresh keeps you logged in.
  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _role = signal<string | null>(localStorage.getItem(ROLE_KEY));

  // Public read-only views other components can react to.
  readonly token = this._token.asReadonly();
  readonly role = this._role.asReadonly();
  readonly isLoggedIn = computed(() => this._token() !== null);
  readonly isAdmin = computed(() => this._role() === 'admin');

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    // FastAPI's OAuth2PasswordRequestForm expects form-encoded fields named
    // 'username' and 'password' — NOT JSON. This is the #1 login gotcha.
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', password);

    return this.http
      .post<LoginResponse>(`${environment.apiBase}/api/auth/login`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        tap((res) => {
          // Store token + role so the interceptor and guards can read them.
          localStorage.setItem(TOKEN_KEY, res.access_token);
          localStorage.setItem(ROLE_KEY, res.role);
          this._token.set(res.access_token);
          this._role.set(res.role);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    this._token.set(null);
    this._role.set(null);
  }

  getToken(): string | null {
    return this._token();
  }
}