import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  UserDetail,
  CreateUserRequest,
  UpdateUserRequest,
  AdminStats,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private base = `${environment.apiBase}/api/admin`;

  constructor(private http: HttpClient) {}

  // ----- Stats -----
  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.base}/stats`);
  }

  // ----- Users -----
  listUsers(opts?: { role?: string; search?: string; limit?: number; offset?: number }):
    Observable<UserDetail[]> {
    let params = new HttpParams();
    if (opts?.role) params = params.set('role', opts.role);
    if (opts?.search) params = params.set('search', opts.search);
    if (opts?.limit != null) params = params.set('limit', opts.limit);
    if (opts?.offset != null) params = params.set('offset', opts.offset);
    return this.http.get<UserDetail[]>(`${this.base}/users`, { params });
  }

  createUser(body: CreateUserRequest): Observable<UserDetail> {
    return this.http.post<UserDetail>(`${this.base}/users`, body);
  }

  updateUser(id: number, body: UpdateUserRequest): Observable<UserDetail> {
    return this.http.patch<UserDetail>(`${this.base}/users/${id}`, body);
  }

  deleteUser(id: number): Observable<void> {
    // 204 No Content — no body to parse.
    return this.http.delete<void>(`${this.base}/users/${id}`);
  }
}