import { hostedSignInGuard } from './features/auth-callback/hosted-sign-in.guard';
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // Sign in: hands off to TODD's hosted login (see hostedSignInGuard).
    path: 'login',
    canActivate: [hostedSignInGuard],
    loadComponent: () => import('./features/security/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'finish-sign-in',
    loadComponent: () => import('./features/security/login/login.component').then((m) => m.LoginComponent),
  },
  {
    // TODD's hosted login returns here with a one-time token.
    path: 'auth/callback',
    loadComponent: () => import('./features/auth-callback/auth-callback.component').then((m) => m.AuthCallbackComponent),
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
  {
    // The universal menu's Awards link: the home page with the awards sheet open.
    path: 'awards',
    data: { awards: true },
    loadComponent: () =>
      import( './features/help/todd/todd.component' ).then(
        ( m ) => m.ToddComponent
      ),
    title: 'Ask TODD Awards',
  },
  { path: '**', redirectTo: '' }
];
