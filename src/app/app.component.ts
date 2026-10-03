import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';

@Component( {
  selector: 'ask-todd-root',
  standalone: true,
  imports: [RouterOutlet, PlatformMenuComponent, AsyncPipe, NgIf],
  template: '<app-platform-menu *ngIf="!isEmbedded" [isAdmin]="(isAdmin$ | async) ?? false" [isLoggedIn]="(isLoggedIn$ | async) ?? false" [userName]="(userName$ | async) ?? \'\'" [userEmail]="(userEmail$ | async) ?? \'\'" (signOut)="signOut()" /><router-outlet />',
} )
export class AppComponent {
  private readonly authService = inject( AuthService );
  readonly user$ = this.authService.getUser();
  readonly isLoggedIn$ = this.user$.pipe( map( user => !!user?.uid ) );
  readonly isAdmin$ = this.user$.pipe( map( user => user?.uid === environment.taliferroTenantId ) );
  readonly userName$ = this.user$.pipe( map( user => user?.displayName || '' ) );
  readonly userEmail$ = this.user$.pipe( map( user => user?.email || '' ) );
  readonly isEmbedded = typeof window !== 'undefined'
    && new URLSearchParams( window.location.search ).get( 'embedded' ) === 'true';

  signOut (): void {
    this.authService.logout().subscribe();
  }
}
