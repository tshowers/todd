import { Routes } from '@angular/router';

export const routes: Routes = [
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
