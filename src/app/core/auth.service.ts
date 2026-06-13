import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResponse } from '../models/auth.model';

const TOKEN_KEY = 'sd_token';
const ROLE_KEY  = 'sd_role';
const UID_KEY   = 'sd_uid';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _token  = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _role   = signal<string | null>(localStorage.getItem(ROLE_KEY));
  private _userId = signal<number | null>(
    localStorage.getItem(UID_KEY) ? Number(localStorage.getItem(UID_KEY)) : null
  );

  readonly token     = this._token.asReadonly();
  readonly role      = this._role.asReadonly();
  readonly userId    = this._userId.asReadonly();
  readonly isLoggedIn = computed(() => this._token() !== null);
  readonly isAdmin    = computed(() => this._role() === 'admin');

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', password);

    return this.http
      .post<LoginResponse>(`${environment.apiBase}/api/auth/login`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.access_token);
          localStorage.setItem(ROLE_KEY,  res.role);
          localStorage.setItem(UID_KEY,   String(res.user_id));
          this._token.set(res.access_token);
          this._role.set(res.role);
          this._userId.set(res.user_id);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(UID_KEY);
    this._token.set(null);
    this._role.set(null);
    this._userId.set(null);
  }

  getToken(): string | null {
    return this._token();
  }
}