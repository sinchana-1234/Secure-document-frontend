import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email    = '';
  password = '';

  // UI state
  error        = signal<string | null>(null);
  loading      = signal(false);
  showPassword = signal(false);       // toggles eye icon

  // Field-level validation signals — shown on blur, not while typing
  emailTouched    = signal(false);
  passwordTouched = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  // ── Validation helpers ─────────────────────────────────────────────────────

  get emailError(): string | null {
    if (!this.emailTouched()) return null;
    if (!this.email.trim())             return 'Email is required.';
    if (!this.isValidEmail(this.email)) return 'Enter a valid email address.';
    return null;
  }

  get passwordError(): string | null {
    if (!this.passwordTouched()) return null;
    if (!this.password)          return 'Password is required.';
    if (this.password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  }

  get formValid(): boolean {
    return this.isValidEmail(this.email) && this.password.length >= 6;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  submit(): void {
    // Mark both fields as touched to show all validation errors at once
    this.emailTouched.set(true);
    this.passwordTouched.set(true);

    if (!this.formValid) return;

    this.error.set(null);
    this.loading.set(true);

    this.auth.login(this.email.trim(), this.password).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.auth.loadMe();        // fetch name/email for the topbar
        // Role-based redirect: admin → /admin, user → /workspace
        this.router.navigate([res.role === 'admin' ? '/admin' : '/workspace']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.status === 401
            ? 'Incorrect email or password.'
            : 'Sign in failed. Is the backend running?'
        );
      },
    });
  }
}