import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ApiService } from '../../core/api.service';
import { DocumentOut } from '../../models/document.model';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
})
export class Workspace implements OnInit {
  pageTitle = signal('Chat');
  pageSubtitle = signal('Ask questions about your documents');
  recent = signal<DocumentOut[]>([]);
  docCount = signal(0);

  constructor(public auth: AuthService, private api: ApiService, private router: Router) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const isFiles = e.urlAfterRedirects.includes('/files');
        this.pageTitle.set(isFiles ? 'Files' : 'Chat');
        this.pageSubtitle.set(isFiles ? 'Upload and manage your documents' : 'Ask questions about your documents');
      });
  }

  ngOnInit() {
    if (!this.auth.email()) this.auth.loadMe();
    this.loadRecent();
  }

  loadRecent() {
    this.api.listDocuments().subscribe({
      next: (docs) => {
        this.docCount.set(docs.length);
        this.recent.set(docs.slice(0, 5));   // max 5 recent files
      },
      error: () => {},
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}