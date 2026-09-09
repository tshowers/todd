import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/security/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'finish-sign-in',
    loadComponent: () => import('./features/security/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/security/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import( './features/help/todd/todd.component' ).then(
        ( m ) => m.ToddComponent
      ),
    title: 'Ask TODD',
  },
  { path: '**', redirectTo: '' }
];
