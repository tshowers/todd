import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';
import { AskChatStateService } from './services/ask-chat-state.service';

@Component( {
  selector: 'ask-todd-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, PlatformMenuComponent, AsyncPipe, NgIf],
  template: `
    <!-- Ask TODD header (design 10a/10b). Help and About draw their own. -->
    <header class="ask-head" *ngIf="!isEmbedded && showHeader">
      <a class="ask-head__brand" routerLink="/">
        <span class="ask-head__logo"><img src="assets/todd-mark-128.png" alt="" /></span>
        <span class="ask-head__title">Ask TODD</span>
      </a>
      <nav class="ask-head__actions" aria-label="Ask TODD">
        <button type="button" class="ask-pill" *ngIf="chat.hasConversation" (click)="chat.newQuestion()" title="New question">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg><span>New question</span>
        </button>
        <button type="button" class="ask-pill" *ngIf="isChatPage" (click)="chat.openSaved()" title="Saved">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg><span>Saved</span>
        </button>
        <button type="button" class="ask-pill ask-pill--text" *ngIf="!((isLoggedIn$ | async) ?? false)" (click)="signIn()">Sign in</button>
        <app-platform-menu [isAdmin]="(isAdmin$ | async) ?? false" [isLoggedIn]="(isLoggedIn$ | async) ?? false" [userName]="(userName$ | async) ?? ''" [userEmail]="(userEmail$ | async) ?? ''" (signOut)="signOut()" />
      </nav>
    </header>
    <router-outlet />
  `,
  styleUrl: './app.component.css',
} )
export class AppComponent {
  private readonly authService = inject( AuthService );
  private readonly router = inject( Router );
  readonly chat = inject( AskChatStateService );
  readonly user$ = this.authService.getUser();
  readonly isLoggedIn$ = this.user$.pipe( map( user => !!user?.uid ) );
  readonly isAdmin$ = this.user$.pipe( map( user => user?.uid === environment.taliferroTenantId ) );
  readonly userName$ = this.user$.pipe( map( user => user?.displayName || '' ) );
  readonly userEmail$ = this.user$.pipe( map( user => user?.email || '' ) );
  readonly isEmbedded = typeof window !== 'undefined'
    && new URLSearchParams( window.location.search ).get( 'embedded' ) === 'true';

  /** The conversation lives on the home page (and /awards, which opens over it). */
  get isChatPage (): boolean {
    const path = this.router.url.split( /[?#]/ )[0];
    return path === '/' || path === '/awards';
  }

  /** Help, About and the sign-in pages draw their own page. */
  get showHeader (): boolean {
    const path = this.router.url.split( /[?#]/ )[0];
    return !['/help', '/about', '/login', '/finish-sign-in', '/auth/callback'].includes( path );
  }

  /** Sign in goes through TODD's hosted login, then comes back to this page. */
  signIn (): void {
    this.authService.startHostedSignIn( this.router.url.split( /[?#]/ )[0] || '/' );
  }

  signOut (): void {
    this.authService.logout().subscribe();
  }
}
