import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import( './features/help/todd-placeholder/todd-placeholder.component' ).then(
        ( m ) => m.ToddPlaceholderComponent
      ),
    title: 'Ask TODD',
  },
  { path: '**', redirectTo: '' }
];
