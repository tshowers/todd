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
    path: 'help',
    loadComponent: () => import('./features/site-help/site-help.component').then((m) => m.SiteHelpComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.component').then((m) => m.AboutComponent),
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
