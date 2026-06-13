import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Admin } from './pages/admin/admin';
import { Workspace } from './pages/workspace/workspace';
import { WsChat } from './pages/workspace/chat/chat';
import { WsFiles } from './pages/workspace/files/files';
import { authGuard, adminGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'admin', component: Admin, canActivate: [adminGuard] },
   {
    path: 'workspace',
    component: Workspace,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'chat', pathMatch: 'full' },   // default view on login
      { path: 'chat', component: WsChat },
      { path: 'files', component: WsFiles },
    ],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];