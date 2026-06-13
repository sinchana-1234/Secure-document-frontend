import { Component } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-workspace',
  standalone: true,
  template: `
    <div style="padding:40px;font-family:sans-serif;">
      <h1>Workspace <span style="color:#0E7C66">(shell)</span></h1>
      <p>You're logged in as a user. Upload + chat come next.</p>
      <button (click)="logout()">Log out</button>
    </div>
  `,
})
export class Workspace {
  constructor(private auth: AuthService, private router: Router) {}
  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}