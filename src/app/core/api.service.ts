import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SearchRequest, SearchResponse } from '../models/search.model';
import { DocumentOut } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiBase;

  constructor(private http: HttpClient) {}

  // ----- RAG search -----
  search(body: SearchRequest): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.base}/api/search`, body);
  }

  // ----- Documents (RBAC-scoped server-side: a user sees only their own) -----
  listDocuments(q?: string): Observable<DocumentOut[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    return this.http.get<DocumentOut[]>(`${this.base}/api/documents`, { params });
  }
  listDocumentsPaged(q: string | undefined, limit: number, offset: number):
      Observable<{ items: DocumentOut[]; total: number }> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (q) params = params.set('q', q);
    return this.http.get<{ items: DocumentOut[]; total: number }>(
      `${this.base}/api/documents/paged`, { params });
  }

  uploadDocument(file: File, title?: string): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    return this.http.post(`${this.base}/api/documents/upload`, form);
  }

  deleteDocument(id: number): Observable<any> {
    return this.http.delete(`${this.base}/api/documents/${id}`);
  }
  
  downloadDocument(id: number, filename: string): void {
    // Authenticated download: the interceptor attaches the JWT, so a plain <a href>
    // won't work (it can't send the header). We fetch the file as a blob, then trigger
    // a browser download from it.
    this.http.get(`${this.base}/api/documents/${id}/download`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename || 'document';
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        },
        error: () => alert('Could not download the file.'),
      });
  }
}
