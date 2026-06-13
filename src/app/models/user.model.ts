// ─── User Models ─────────────────────────────────────────────────────────────

/** Mirrors backend UserDetail — returned by GET/POST/PATCH /api/admin/users */
export interface UserDetail {
  id: number;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  created_at: string | null; // ISO datetime string
  document_count: number;
}

/** Body for POST /api/admin/users (AdminUserCreate) */
export interface CreateUserRequest {
  email: string;
  password: string;
  full_name?: string | null;
  role: 'user' | 'admin';
}

/** Body for PATCH /api/admin/users/{id} (AdminUserUpdate) — all optional */
export interface UpdateUserRequest {
  full_name?: string | null;
  role?: 'user' | 'admin' | null;
  password?: string | null;
}

// ─── Document Models ──────────────────────────────────────────────────────────

/** Mirrors backend DocumentAdminOut — returned by GET /api/admin/documents */
export interface DocumentAdminOut {
  id: number;
  original_filename: string;
  title: string | null;
  doc_type: string;
  size_bytes: number;
  tags: string[];
  page_count: number | null;
  num_chunks: number | null;
  ocr_used: string | null;
  status: DocStatus;
  error_message: string | null;
  duplicate_of_id: number | null;
  upload_date: string; // ISO datetime string
  owner_id: number;
  owner_email: string | null;
  owner_name: string | null;
}

export type DocStatus = 'pending' | 'processing' | 'indexed' | 'duplicate' | 'failed';

// ─── Stats Model ──────────────────────────────────────────────────────────────

/** Mirrors backend AdminStats — returned by GET /api/admin/stats */
export interface AdminStats {
  total_users: number;
  total_documents: number;
  indexed_documents: number;
  failed_documents: number;
  duplicate_documents: number;
}

// ─── Query Params ─────────────────────────────────────────────────────────────

export interface ListUsersParams {
  role?: 'user' | 'admin';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListDocumentsParams {
  status?: DocStatus;
  doc_type?: string;
  owner_id?: number;
  search?: string;
  limit?: number;
  offset?: number;
}