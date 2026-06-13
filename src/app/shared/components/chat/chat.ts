import { Component, signal, OnInit} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { SourceRef } from '../../../models/search.model';
import { DecimalPipe } from '@angular/common';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: SourceRef[];
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat implements OnInit {
  messages = signal<ChatMessage[]>([]);

  ngOnInit() {
    // Seed the conversation with an assistant greeting so chat opens like a real
    // chatbot, not an empty page.
    this.messages.set([{
      role: 'assistant',
      text: "Hi! I'm SecureDoc, your document assistant. Ask me anything about your uploaded files — I'll answer using only your documents and cite the exact sources, which you can download right from the chat. What would you like to know?",
    }]);
  }
  question = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private api: ApiService) {}

  ask() {
    const q = this.question.trim();
    if (!q || this.loading()) return;

    this.error.set(null);
    this.messages.update((m) => [...m, { role: 'user', text: q }]);
    this.question = '';
    this.loading.set(true);

    this.api.search({ question: q }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.messages.update((m) => [
          ...m,
          { role: 'assistant', text: res.answer, sources: res.sources },
        ]);
      },
      error: (err) => {
        this.loading.set(false);
        const msg =
          err.status === 503 ? 'Search is not configured (missing API key).' :
          err.status === 502 ? 'The AI service is temporarily unavailable.' :
          'Something went wrong. Please try again.';
        this.error.set(msg);
      },
    });
  }
  download(id: number | null, title: string | null) {
    if (id == null) return;
    this.api.downloadDocument(id, title || `document-${id}`);
  }

  // Cited chunks often come from the SAME document (6 chips, one file). Dedupe by
  // document_id so we show each downloadable document once.
  uniqueDocs(sources?: SourceRef[]): { id: number; title: string }[] {
    if (!sources) return [];
    const seen = new Map<number, string>();
    for (const s of sources) {
      if (s.document_id != null && !seen.has(s.document_id)) {
        seen.set(s.document_id, s.title || `Document ${s.document_id}`);
      }
    }
    return Array.from(seen, ([id, title]) => ({ id, title }));
  }
}