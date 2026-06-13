// Mirrors your backend Token + UserOut schemas.
export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;        // 'admin' | 'user'
  user_id: number;
}

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}