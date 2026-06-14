import {
  Component,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  ViewEncapsulation,
} from '@angular/core';
import { DatePipe, SlicePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { AdminService } from '../../core/admin.service';
import { ApiService } from '../../core/api.service';
import { SourceRef } from '../../models/search.model';
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

interface AdminChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: SourceRef[];
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, DatePipe, SlicePipe, NgClass],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
  encapsulation: ViewEncapsulation.None,
})
export class Admin implements OnInit, OnDestroy, AfterViewChecked {
  private readonly destroy$ = new Subject<void>();

  // ── Tab ────────────────────────────────────────────────────────────────────
  activeTab = signal<ActiveTab>('users');

  // ── Stats ──────────────────────────────────────────────────────────────────
  stats = signal<AdminStats | null>(null);

  // ── Users ──────────────────────────────────────────────────────────────────
  users        = signal<UserDetail[]>([]);
  usersTotal   = signal<number>(0);   // ← NEW: total count from backend
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

  // Create-user field touch state
  cuEmailTouched    = signal(false);
  cuPasswordTouched = signal(false);
  cuShowPassword    = signal(false);

  // Edit user modal
  editUser       = signal<EditUserState | null>(null);
  editSaving     = signal(false);
  editError      = signal<string | null>(null);
  euShowPassword = signal(false);

  // ── Documents ──────────────────────────────────────────────────────────────
  documents   = signal<DocumentAdminOut[]>([]);
  docsTotal   = signal<number>(0);    // ← NEW: total count from backend
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

  // ── Floating Chat ──────────────────────────────────────────────────────────
  chatOpen      = signal(false);
  chatMessages  = signal<AdminChatMessage[]>([{
    role: 'assistant',
    text: "Hi! I'm SecureDoc assistant. Ask me anything about the uploaded documents.",
  }]);
  chatQuestion  = signal('');
  chatLoading   = signal(false);
  chatError     = signal<string | null>(null);
  chatUnread    = signal(0);

  @ViewChild('chatBody') private chatBodyRef!: ElementRef<HTMLDivElement>;
  private shouldScrollChat = false;

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly myId = computed(() => this.auth.userId());

  // FIX: use total signals for accurate pagination instead of checking array length
  readonly hasMoreUsers = computed(() =>
    (this.userPage + 1) * this.PAGE_SIZE < this.usersTotal()
  );
  readonly hasMoreDocs = computed(() =>
    (this.docPage + 1) * this.PAGE_SIZE < this.docsTotal()
  );

  readonly adminInitial = computed(() => this.auth.initial());
  readonly adminName    = computed(() => this.auth.fullName() || this.auth.email() || 'Admin');
  readonly adminEmail   = computed(() => this.auth.email() ?? '');

  readonly pageTitle = computed(() =>
    this.activeTab() === 'users' ? 'Users' : 'Documents'
  );
  readonly pageSubtitle = computed(() =>
    this.activeTab() === 'users'
      ? 'Manage platform members and roles'
      : 'Browse and manage uploaded documents'
  );

  // Human-readable page info: "Page 1 of 3"
  readonly userPageInfo = computed(() => {
    const total = this.usersTotal();
    if (total === 0) return '';
    const totalPages = Math.ceil(total / this.PAGE_SIZE);
    return `Page ${this.userPage + 1} of ${totalPages} (${total} total)`;
  });

  readonly docPageInfo = computed(() => {
    const total = this.docsTotal();
    if (total === 0) return '';
    const totalPages = Math.ceil(total / this.PAGE_SIZE);
    return `Page ${this.docPage + 1} of ${totalPages} (${total} total)`;
  });

  private readonly userSearchChange$ = new Subject<string>();
  private readonly docSearchChange$  = new Subject<string>();

  constructor(
    private auth:     AuthService,
    private adminSvc: AdminService,
    private api:      ApiService,
    private router:   Router,
  ) {}

  ngOnInit(): void {
    this.auth.loadMe();
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

  ngAfterViewChecked(): void {
    if (this.shouldScrollChat && this.chatBodyRef) {
      const el = this.chatBodyRef.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScrollChat = false;
    }
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
      next: (res) => {
        // ✅ FIX: backend returns { items: [...], total: N } — unwrap correctly
        const items = Array.isArray(res.items) ? res.items : [];
        this.users.set(items);
        this.usersTotal.set(res.total ?? 0);
        this.usersLoading.set(false);
      },
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

  get cuEmailError(): string | null {
    if (!this.cuEmailTouched()) return null;
    if (!this.newUser.email.trim()) return 'Email is required.';
    if (!this.isValidEmail(this.newUser.email)) return 'Enter a valid email address.';
    return null;
  }

  get cuPasswordError(): string | null {
    if (!this.cuPasswordTouched()) return null;
    if (!this.newUser.password) return 'Password is required.';
    if (this.newUser.password.length < 6) return 'Must be at least 6 characters.';
    return null;
  }

  submitCreateUser(): void {
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
    this.editUser.set({
      id: u.id,
      email: u.email,
      full_name: u.full_name ?? '',
      role: u.role as 'user' | 'admin',
      password: '',
    });
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
        this.usersTotal.update(n => Math.max(0, n - 1));
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

    const ownerId = this.docOwnerFilter.trim()
      ? parseInt(this.docOwnerFilter, 10)
      : undefined;

    const params: ListDocumentsParams = {
      search:   this.docSearch.trim() || undefined,
      status:   (this.docStatus as DocStatus) || undefined,
      doc_type: this.docType || undefined,
      owner_id: isNaN(ownerId as number) ? undefined : ownerId,
      limit:    this.PAGE_SIZE,
      offset:   this.docPage * this.PAGE_SIZE,
    };

    this.adminSvc.listDocuments(params).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        // ✅ FIX: backend returns { items: [...], total: N } — unwrap correctly
        const items = Array.isArray(res.items) ? res.items : [];
        this.documents.set(items);
        this.docsTotal.set(res.total ?? 0);
        this.docsLoading.set(false);
      },
      error: () => {
        this.docsError.set('Could not load documents.');
        this.docsLoading.set(false);
      },
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
    if (!confirm(
      `Permanently delete "${doc.original_filename}"?\n\nThis removes the file, its vectors, and all metadata.`
    )) return;

    this.adminSvc.deleteDocument(doc.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.documents.update((list) => list.filter((d) => d.id !== doc.id));
        this.docsTotal.update(n => Math.max(0, n - 1));
        this.loadStats();
        this.showToast('Document deleted.', 'success');
      },
      error: () => this.docsError.set('Could not delete that document.'),
    });
  }

  // ── Sign-out ───────────────────────────────────────────────────────────────

  requestLogout(): void { this.showLogoutConfirm.set(true); }
  cancelLogout():  void { this.showLogoutConfirm.set(false); }

  confirmLogout(): void {
    this.showLogoutConfirm.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  logout(): void { this.requestLogout(); }

  // ── Toast ──────────────────────────────────────────────────────────────────

  showToast(message: string, type: 'success' | 'error'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ message, type });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }

  // ── Floating Chat ──────────────────────────────────────────────────────────

  toggleChat(): void {
    const opening = !this.chatOpen();
    this.chatOpen.set(opening);
    if (opening) {
      this.chatUnread.set(0);
      this.shouldScrollChat = true;
    }
  }

  closeChat(): void { this.chatOpen.set(false); }

  askChat(): void {
    const q = this.chatQuestion().trim();
    if (!q || this.chatLoading()) return;

    this.chatError.set(null);
    this.chatMessages.update(m => [...m, { role: 'user', text: q }]);
    this.chatQuestion.set('');
    this.chatLoading.set(true);
    this.shouldScrollChat = true;

    this.api.search({ question: q }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.chatLoading.set(false);
        this.chatMessages.update(m => [...m, {
          role: 'assistant',
          text: res.answer,
          sources: res.sources,
        }]);
        this.shouldScrollChat = true;
        if (!this.chatOpen()) this.chatUnread.update(n => n + 1);
      },
      error: (err) => {
        this.chatLoading.set(false);
        this.chatError.set(
          err.status === 503 ? 'Search not configured (missing API key).' :
          err.status === 502 ? 'AI service temporarily unavailable.' :
          'Something went wrong. Please try again.'
        );
        this.shouldScrollChat = true;
      },
    });
  }

  chatUniqueDocSources(sources?: SourceRef[]): { id: number; title: string }[] {
    if (!sources) return [];
    const seen = new Map<number, string>();
    for (const s of sources) {
      if (s.document_id != null && !seen.has(s.document_id)) {
        seen.set(s.document_id, s.title || `Document ${s.document_id}`);
      }
    }
    return Array.from(seen, ([id, title]) => ({ id, title }));
  }

  downloadDoc(id: number | null, title: string | null): void {
    if (id == null) return;
    this.api.downloadDocument(id, title || `document-${id}`);
  }
  

  // ── Utilities ──────────────────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
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
}