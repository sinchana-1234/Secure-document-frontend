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
  email = '';
  password = '';
  error = signal<string | null>(null);
  loading = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    this.error.set(null);
    this.loading.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading.set(false);
        // Role-based redirect: admin -> /admin, user -> /workspace
        this.router.navigate([res.role === 'admin' ? '/admin' : '/workspace']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.status === 401 ? 'Incorrect email or password.' : 'Login failed. Is the backend running?'
        );
      },
    });
  }
}