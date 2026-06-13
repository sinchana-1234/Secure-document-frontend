import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/api.service';
import { DocumentOut } from '../../../models/document.model';
import { friendlyStatus } from '../../../core/status';

@Component({
  selector: 'app-ws-files',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './files.html',
  styleUrl: './files.css',
})
export class WsFiles implements OnInit {
  files = signal<DocumentOut[]>([]);
  loading = signal(false);
  search = '';

  selectedFile: File | null = null;
  uploading = signal(false);
  uploadMsg = signal<string | null>(null);
  uploadErr = signal<string | null>(null);

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.listDocuments(this.search || undefined).subscribe({
      next: (list) => { this.files.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  onFilePicked(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    this.uploadMsg.set(null);
    this.uploadErr.set(null);
  }

  upload() {
    if (!this.selectedFile) return;
    this.uploading.set(true);
    this.uploadMsg.set(null);
    this.uploadErr.set(null);
    this.api.uploadDocument(this.selectedFile).subscribe({
      next: () => {
        this.uploading.set(false);
        this.uploadMsg.set('Uploaded successfully.');
        this.selectedFile = null;
        this.load();
      },
      error: (err) => {
        this.uploading.set(false);
        // Upload pipeline isn't built yet — show a clear message instead of a crash.
        this.uploadErr.set(
          err.status === 400 ? (err.error?.detail || 'Invalid file.') :
          'Upload is not available yet (backend pipeline in progress).'
        );
      },
    });
  }
  friendly(status: string) { return friendlyStatus(status); }
  delete(f: DocumentOut) {
    if (!confirm(`Delete ${f.original_filename}?`)) return;
    this.api.deleteDocument(f.id).subscribe({ next: () => this.load() });
  }

  downloadFile(f: DocumentOut) {
    this.api.downloadDocument(f.id, f.original_filename);
  }

  statusClass(s: string) { return s; }
}