import {
  Component,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ViewEncapsulation,
} from '@angular/core';
import { DatePipe, SlicePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { AdminService } from '../../core/admin.service';
import {
  UserDetail,
  AdminStats,
  CreateUserRequest,
  UpdateUserRequest,
  DocumentAdminOut,
  ListDocumentsParams,
  ListUsersParams,
  DocStatus,
} from '../../models/user.model';

type ActiveTab = 'users' | 'documents';

interface EditUserState {
  id: number;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  password: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, DatePipe, SlicePipe, NgClass],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
  encapsulation: ViewEncapsulation.None,
})
export class Admin implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // ── Tab ────────────────────────────────────────────────────────────────────
  activeTab = signal<ActiveTab>('users');

  // ── Stats ──────────────────────────────────────────────────────────────────
  stats = signal<AdminStats | null>(null);

  // ── Users ──────────────────────────────────────────────────────────────────
  users        = signal<UserDetail[]>([]);
  usersLoading = signal(false);
  usersError   = signal<string | null>(null);

  userSearch     = '';
  userRoleFilter = '';
  userPage       = 0;
  readonly PAGE_SIZE = 20;

  // Create user modal
  showCreateUser = signal(false);
  creating       = signal(false);
  createError    = signal<string | null>(null);
  newUser: CreateUserRequest = this.blankNewUser();

  // Create-user field touch state (for inline validation)
  cuEmailTouched    = signal(false);
  cuPasswordTouched = signal(false);
  cuShowPassword    = signal(false);

  // Edit user modal
  editUser   = signal<EditUserState | null>(null);
  editSaving = signal(false);
  editError  = signal<string | null>(null);
  euShowPassword = signal(false);

  // ── Documents ──────────────────────────────────────────────────────────────
  documents   = signal<DocumentAdminOut[]>([]);
  docsLoading = signal(false);
  docsError   = signal<string | null>(null);

  docSearch      = '';
  docStatus      = '';
  docType        = '';
  docOwnerFilter = '';
  docPage        = 0;

  // ── Sign-out confirmation modal ────────────────────────────────────────────
  showLogoutConfirm = signal(false);

  // ── Toast notification ─────────────────────────────────────────────────────
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly myId         = computed(() => this.auth.userId());
  readonly hasMoreUsers = computed(() => this.users().length === this.PAGE_SIZE);
  readonly hasMoreDocs  = computed(() => this.documents().length === this.PAGE_SIZE);

  private readonly userSearchChange$ = new Subject<string>();
  private readonly docSearchChange$  = new Subject<string>();

  constructor(
    private auth:     AuthService,
    private adminSvc: AdminService,
    private router:   Router,
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadUsers();

    this.userSearchChange$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => { this.userPage = 0; this.loadUsers(); });

    this.docSearchChange$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => { this.docPage = 0; this.loadDocuments(); });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── Tab ────────────────────────────────────────────────────────────────────

  switchTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    if (tab === 'documents' && this.documents().length === 0) {
      this.loadDocuments();
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  loadStats(): void {
    this.adminSvc.getStats().pipe(takeUntil(this.destroy$)).subscribe({
      next: (s) => this.stats.set(s),
      error: () => {},
    });
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  loadUsers(): void {
    this.usersLoading.set(true);
    this.usersError.set(null);

    const params: ListUsersParams = {
      search: this.userSearch.trim() || undefined,
      role:   (this.userRoleFilter as 'user' | 'admin') || undefined,
      limit:  this.PAGE_SIZE,
      offset: this.userPage * this.PAGE_SIZE,
    };

    this.adminSvc.listUsers(params).pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => { this.users.set(list); this.usersLoading.set(false); },
      error: () => {
        this.usersError.set('Could not load users. Check that the backend is running.');
        this.usersLoading.set(false);
      },
    });
  }

  onUserSearchInput(): void { this.userSearchChange$.next(this.userSearch); }
  onUserRoleChange():  void { this.userPage = 0; this.loadUsers(); }
  prevUserPage():      void { if (this.userPage > 0) { this.userPage--; this.loadUsers(); } }
  nextUserPage():      void { if (this.hasMoreUsers()) { this.userPage++; this.loadUsers(); } }

  // ── Create user ────────────────────────────────────────────────────────────

  openCreateUser(): void {
    this.newUser = this.blankNewUser();
    this.cuEmailTouched.set(false);
    this.cuPasswordTouched.set(false);
    this.cuShowPassword.set(false);
    this.createError.set(null);
    this.showCreateUser.set(true);
  }

  closeCreateUser(): void { this.showCreateUser.set(false); }

  /** Inline validation for create-user email */
  get cuEmailError(): string | null {
    if (!this.cuEmailTouched()) return null;
    if (!this.newUser.email.trim()) return 'Email is required.';
    if (!this.isValidEmail(this.newUser.email)) return 'Enter a valid email address.';
    return null;
  }

  /** Inline validation for create-user password */
  get cuPasswordError(): string | null {
    if (!this.cuPasswordTouched()) return null;
    if (!this.newUser.password) return 'Password is required.';
    if (this.newUser.password.length < 6) return 'Must be at least 6 characters.';
    return null;
  }

  submitCreateUser(): void {
    // Touch all fields to reveal any errors
    this.cuEmailTouched.set(true);
    this.cuPasswordTouched.set(true);
    this.createError.set(null);

    if (!this.newUser.email.trim() || !this.isValidEmail(this.newUser.email)) {
      this.createError.set('Please enter a valid email address.'); return;
    }
    if (!this.newUser.password || this.newUser.password.length < 6) {
      this.createError.set('Password must be at least 6 characters.'); return;
    }

    this.creating.set(true);
    this.adminSvc.createUser(this.newUser).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.creating.set(false);
        this.showCreateUser.set(false);
        this.userPage = 0;
        this.loadUsers();
        this.loadStats();
        this.showToast('User created successfully.', 'success');
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(
          err.status === 409
            ? 'That email is already registered.'
            : (err.error?.detail ?? 'Could not create user.')
        );
      },
    });
  }

  // ── Edit user ──────────────────────────────────────────────────────────────

  openEditUser(u: UserDetail): void {
    this.editError.set(null);
    this.euShowPassword.set(false);
    this.editUser.set({ id: u.id, email: u.email, full_name: u.full_name ?? '', role: u.role, password: '' });
  }

  closeEditUser(): void { this.editUser.set(null); }

  submitEditUser(): void {
    const state = this.editUser();
    if (!state) return;

    this.editError.set(null);

    const body: UpdateUserRequest = {};
    body.full_name = state.full_name.trim() || null;
    body.role      = state.role;

    if (state.password.trim()) {
      if (state.password.length < 6) {
        this.editError.set('New password must be at least 6 characters.'); return;
      }
      body.password = state.password;
    }

    this.editSaving.set(true);
    this.adminSvc.updateUser(state.id, body).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.editSaving.set(false);
        this.editUser.set(null);
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
        this.showToast('User updated successfully.', 'success');
      },
      error: (err) => {
        this.editSaving.set(false);
        this.editError.set(err.error?.detail ?? 'Could not save changes.');
      },
    });
  }

  deleteUser(u: UserDetail): void {
    if (u.id === this.myId()) return;
    if (!confirm(`Permanently delete ${u.email}?\n\nThis cannot be undone.`)) return;

    this.adminSvc.deleteUser(u.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.users.update((list) => list.filter((x) => x.id !== u.id));
        this.loadStats();
        this.showToast('User deleted.', 'success');
      },
      error: () => this.usersError.set('Could not delete that user.'),
    });
  }

  // ── Documents ──────────────────────────────────────────────────────────────

  loadDocuments(): void {
    this.docsLoading.set(true);
    this.docsError.set(null);

    const ownerId = this.docOwnerFilter.trim() ? parseInt(this.docOwnerFilter, 10) : undefined;

    const params: ListDocumentsParams = {
      search:   this.docSearch.trim() || undefined,
      status:   (this.docStatus as DocStatus) || undefined,
      doc_type: this.docType || undefined,
      owner_id: isNaN(ownerId as number) ? undefined : ownerId,
      limit:    this.PAGE_SIZE,
      offset:   this.docPage * this.PAGE_SIZE,
    };

    this.adminSvc.listDocuments(params).pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => { this.documents.set(list); this.docsLoading.set(false); },
      error: () => { this.docsError.set('Could not load documents.'); this.docsLoading.set(false); },
    });
  }

  onDocSearchInput():  void { this.docSearchChange$.next(this.docSearch); }
  onDocFilterChange(): void { this.docPage = 0; this.loadDocuments(); }
  prevDocPage():       void { if (this.docPage > 0) { this.docPage--; this.loadDocuments(); } }
  nextDocPage():       void { if (this.hasMoreDocs()) { this.docPage++; this.loadDocuments(); } }

  filterByOwner(ownerId: number): void {
    this.docOwnerFilter = String(ownerId);
    this.docPage = 0;
    this.switchTab('documents');
    this.loadDocuments();
  }

  deleteDocument(doc: DocumentAdminOut): void {
    if (!confirm(`Permanently delete "${doc.original_filename}"?\n\nThis removes the file, its vectors, and all metadata.`)) return;

    this.adminSvc.deleteDocument(doc.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.documents.update((list) => list.filter((d) => d.id !== doc.id));
        this.loadStats();
        this.showToast('Document deleted.', 'success');
      },
      error: () => this.docsError.set('Could not delete that document.'),
    });
  }

  // ── Sign-out confirmation ──────────────────────────────────────────────────

  /** Shows the confirm-sign-out modal instead of logging out immediately */
  requestLogout(): void {
    this.showLogoutConfirm.set(true);
  }

  cancelLogout(): void {
    this.showLogoutConfirm.set(false);
  }

  confirmLogout(): void {
    this.showLogoutConfirm.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  showToast(message: string, type: 'success' | 'error'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ message, type });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (bytes < 1024)         return `${bytes} B`;
    if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      indexed:    'status-indexed',
      failed:     'status-failed',
      duplicate:  'status-duplicate',
      processing: 'status-processing',
      pending:    'status-pending',
    };
    return map[status] ?? '';
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  private blankNewUser(): CreateUserRequest {
    return { email: '', password: '', full_name: '', role: 'user' };
  }

  // alias for old template reference
  logout(): void { this.requestLogout(); }
}