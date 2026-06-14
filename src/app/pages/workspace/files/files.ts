import { Component, signal,computed, OnInit } from '@angular/core';
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
  page     = signal(0);
  total    = signal(0);
  readonly PAGE_SIZE = 10;
  readonly hasMore = computed(() => (this.page() + 1) * this.PAGE_SIZE < this.total());
  readonly totalPages = computed(() => Math.ceil(this.total() / this.PAGE_SIZE));
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
    this.api.listDocumentsPaged(this.search || undefined, this.PAGE_SIZE, this.page() * this.PAGE_SIZE)
      .subscribe({
        next: (res) => {
          this.files.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); },
      });
  }

  prevPage() { if (this.page() > 0) { this.page.set(this.page() - 1); this.load(); } }
  nextPage() { if (this.hasMore()) { this.page.set(this.page() + 1); this.load(); } }
  doSearch() { this.page.set(0); this.load(); }


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

          this.uploadErr.set('This file is already uploaded — we kept your existing copy.');
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

  pendingDelete = signal<DocumentOut | null>(null);

  delete(f: DocumentOut) {
    this.pendingDelete.set(f);   // open the confirmation modal
  }

  cancelDelete() {
    this.pendingDelete.set(null);
  }

  confirmDelete() {
    const f = this.pendingDelete();
    if (!f) return;
    this.api.deleteDocument(f.id).subscribe({
      next: () => { this.pendingDelete.set(null); this.load(); },
      error: () => { this.pendingDelete.set(null); },
    });
  }

  downloadFile(f: DocumentOut) {
    this.api.downloadDocument(f.id, f.original_filename);
  }
}