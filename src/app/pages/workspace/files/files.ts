import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/api.service';
import { DocumentOut } from '../../../models/document.model';
import { friendlyStatus } from '../../../core/status';

// Shape the backend returns for every upload (200 OK always)
interface UploadResponse {
  status: 'indexed' | 'processing' | 'pending' | 'duplicate' | 'failed';
  message?: string;
  document?: DocumentOut | null;
  duplicate_of_id?: number | null;
  duplicate_kind?: 'exact' | 'near' | null;
  similarity?: number | null;
}

@Component({
  selector: 'app-ws-files',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './files.html',
  styleUrl: './files.css',
})
export class WsFiles implements OnInit {
  files    = signal<DocumentOut[]>([]);
  loading  = signal(false);
  search   = '';

  selectedFile: File | null = null;
  uploading    = signal(false);
  uploadMsg    = signal<string | null>(null);
  uploadErr    = signal<string | null>(null);

  // ── NEW: duplicate state ────────────────────────────────────────────────
  dupInfo = signal<{
    kind: string;
    existingId: number;
    similarity: number | null;
  } | null>(null);

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.listDocuments(this.search || undefined).subscribe({
      next: (list) => { this.files.set(list); this.loading.set(false); },
      error: ()     => { this.loading.set(false); },
    });
  }

  onFilePicked(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    // Clear all feedback on new file pick
    this.uploadMsg.set(null);
    this.uploadErr.set(null);
    this.dupInfo.set(null);
  }

  upload() {
    if (!this.selectedFile) return;
    this.uploading.set(true);
    this.uploadMsg.set(null);
    this.uploadErr.set(null);
    this.dupInfo.set(null);

    this.api.uploadDocument(this.selectedFile).subscribe({
      next: (res: UploadResponse) => {
        this.uploading.set(false);

        // ── DUPLICATE (exact or near) ──────────────────────────────────────
        if (res.status === 'duplicate') {
          const kind  = res.duplicate_kind === 'near' ? 'near-duplicate' : 'exact duplicate';
          const simPct = res.similarity != null
            ? ` (${(res.similarity * 100).toFixed(1)}% similar)`
            : '';

          this.dupInfo.set({
            kind: res.duplicate_kind ?? 'exact',
            existingId: res.duplicate_of_id!,
            similarity: res.similarity ?? null,
          });

          this.uploadErr.set(
            `This file is an ${kind} of document #${res.duplicate_of_id}${simPct}. ` +
            `It was not uploaded again.`
          );
          return;
        }

        // ── SUCCESS ────────────────────────────────────────────────────────
        this.uploadMsg.set(
          res.status === 'processing'
            ? 'File uploaded — indexing in progress.'
            : 'Uploaded and indexed successfully.'
        );
        this.selectedFile = null;
        this.load();
      },

      error: (err) => {
        this.uploading.set(false);
        this.uploadErr.set(
          err.status === 400 ? (err.error?.detail ?? 'Invalid file.') :
          err.status === 413 ? 'File is too large.' :
          err.status === 503 ? 'Indexing service unavailable. Try again shortly.' :
          'Upload failed. Please try again.'
        );
      },
    });
  }

  friendly(status: string) { return friendlyStatus(status); }

  delete(f: DocumentOut) {
    if (!confirm(`Delete "${f.original_filename}"?\nThis cannot be undone.`)) return;
    this.api.deleteDocument(f.id).subscribe({ next: () => this.load() });
  }

  downloadFile(f: DocumentOut) {
    this.api.downloadDocument(f.id, f.original_filename);
  }
}