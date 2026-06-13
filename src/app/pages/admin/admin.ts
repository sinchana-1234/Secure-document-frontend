import { Component, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AdminService } from '../../core/admin.service';
import { UserDetail, AdminStats, CreateUserRequest } from '../../models/user.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  stats = signal<AdminStats | null>(null);
  users = signal<UserDetail[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // search box
  search = '';

  // create-user form
  showCreate = signal(false);
  newUser: CreateUserRequest = { email: '', password: '', full_name: '', role: 'user' };
  createError = signal<string | null>(null);
  creating = signal(false);

  myId = computed(() => this.auth.userId());

  constructor(
    private auth: AuthService,
    private admin: AdminService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadStats();
    this.loadUsers();
  }

  loadStats() {
    this.admin.getStats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => {}, // stats are non-critical; ignore quietly
    });
  }

  loadUsers() {
    this.loading.set(true);
    this.error.set(null);
    this.admin.listUsers({ search: this.search || undefined }).subscribe({
      next: (list) => { this.users.set(list); this.loading.set(false); },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Failed to load users. Is the backend running?');
      },
    });
  }

  createUser() {
    this.createError.set(null);
    if (!this.newUser.email || this.newUser.password.length < 6) {
      this.createError.set('Email required and password must be at least 6 characters.');
      return;
    }
    this.creating.set(true);
    this.admin.createUser(this.newUser).subscribe({
      next: () => {
        this.creating.set(false);
        this.showCreate.set(false);
        this.newUser = { email: '', password: '', full_name: '', role: 'user' };
        this.loadUsers();
        this.loadStats();
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(
          err.status === 409 ? 'That email is already registered.' : 'Could not create user.'
        );
      },
    });
  }

  deleteUser(u: UserDetail) {
    if (u.id === this.myId()) return; // self-delete blocked by backend anyway
    if (!confirm(`Delete user ${u.email}? This cannot be undone.`)) return;
    this.admin.deleteUser(u.id).subscribe({
      next: () => { this.loadUsers(); this.loadStats(); },
      error: () => this.error.set('Could not delete that user.'),
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}