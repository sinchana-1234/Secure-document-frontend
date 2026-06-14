import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  UserDetail,
  CreateUserRequest,
  UpdateUserRequest,
  AdminStats,
  DocumentAdminOut,
  ListUsersParams,
  ListDocumentsParams,
} from '../models/user.model';

// ── Paginated response wrappers (match backend UserListResponse / DocumentListResponse) ──
export interface UserListResponse {
  items: UserDetail[];
  total: number;
}

export interface DocumentListResponse {
  items: DocumentAdminOut[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly base = `${environment.apiBase}/api/admin`;

  constructor(private http: HttpClient) {}

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.base}/stats`);
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  /**
   * Returns the full paginated response so callers can access both
   * `items` (the user array) and `total` (for pagination).
   */
  listUsers(params?: ListUsersParams): Observable<UserListResponse> {
    let p = new HttpParams();
    if (params?.role)        p = p.set('role',   params.role);
    if (params?.search)      p = p.set('search', params.search);
    if (params?.limit  != null) p = p.set('limit',  params.limit);
    if (params?.offset != null) p = p.set('offset', params.offset);

    return this.http.get<UserListResponse>(`${this.base}/users`, { params: p });
  }

  getUser(id: number): Observable<UserDetail> {
    return this.http.get<UserDetail>(`${this.base}/users/${id}`);
  }

  createUser(body: CreateUserRequest): Observable<UserDetail> {
    return this.http.post<UserDetail>(`${this.base}/users`, body);
  }

  updateUser(id: number, body: UpdateUserRequest): Observable<UserDetail> {
    return this.http.patch<UserDetail>(`${this.base}/users/${id}`, body);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${id}`);
  }

  // ── Documents ──────────────────────────────────────────────────────────────

  /**
   * Returns the full paginated response so callers can access both
   * `items` (the document array) and `total` (for pagination).
   */
  listDocuments(params?: ListDocumentsParams): Observable<DocumentListResponse> {
    let p = new HttpParams();
    if (params?.status)      p = p.set('status',   params.status);
    if (params?.doc_type)    p = p.set('doc_type',  params.doc_type);
    if (params?.owner_id != null) p = p.set('owner_id', params.owner_id);
    if (params?.search)      p = p.set('search',   params.search);
    if (params?.limit  != null)   p = p.set('limit',    params.limit);
    if (params?.offset != null)   p = p.set('offset',   params.offset);

    return this.http.get<DocumentListResponse>(`${this.base}/documents`, { params: p });
  }

  deleteDocument(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/documents/${id}`);
  }
}