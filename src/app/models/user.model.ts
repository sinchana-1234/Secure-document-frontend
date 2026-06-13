// Mirrors backend UserDetail (GET/POST/PATCH /api/admin/users responses).
export interface UserDetail {
  id: number;
  email: string;
  full_name: string | null;
  role: string;                 // 'admin' | 'user'
  created_at: string | null;    // ISO datetime string
  document_count: number;
}

// Body for POST /api/admin/users (AdminUserCreate).
export interface CreateUserRequest {
  email: string;
  password: string;
  full_name?: string | null;
  role: string;                 // 'user' | 'admin'
}

// Body for PATCH /api/admin/users/{id} (AdminUserUpdate) — all optional.
export interface UpdateUserRequest {
  full_name?: string | null;
  role?: string | null;
  password?: string | null;
}

// GET /api/admin/stats
export interface AdminStats {
  total_users: number;
  total_documents: number;
  indexed_documents: number;
  failed_documents: number;
  duplicate_documents: number;
}