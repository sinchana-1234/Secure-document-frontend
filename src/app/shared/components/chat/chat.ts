import { Component, signal, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { SourceRef } from '../../../models/search.model';
import { DecimalPipe } from '@angular/common';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: SourceRef[];
  blocked?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;
  private shouldScroll = false;

  ngAfterViewChecked() {
    if (this.shouldScroll && this.messagesContainer) {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  messages = signal<ChatMessage[]>([]);

  ngOnInit() {
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
    this.shouldScroll = true;

    this.api.search({ question: q }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.messages.update((m) => [
          ...m,
          { role: 'assistant', text: res.answer, sources: res.sources },
        ]);
        this.shouldScroll = true;
      },
      error: (err) => {
        this.loading.set(false);

        // 400 = firewall blocked or bad input — show as an assistant message
        // so it appears inline in the chat, not as a floating error banner.
        // Message is intentionally generic — never expose security internals to users.
        if (err.status === 400) {
          const detail = err.error?.detail ?? "I'm sorry, that request couldn't be processed. Please try a different question.";
          this.messages.update((m) => [
            ...m,
            { role: 'assistant', text: detail, blocked: true },
          ]);
        } else {
          const msg =
            err.status === 503 ? 'Search is not configured. Please contact support.' :
            err.status === 502 ? 'The service is temporarily unavailable. Please try again shortly.' :
            'Something went wrong. Please try again.';
          this.error.set(msg);
        }
        this.shouldScroll = true;
      },
    });
  }

  download(id: number | null, title: string | null) {
    if (id == null) return;
    this.api.downloadDocument(id, title || `document-${id}`);
  }

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