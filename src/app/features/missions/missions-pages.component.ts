import { Component, Directive, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { Playbook } from '../../shared/missions/missions.model';
import { PlanReplyComponent } from '../../shared/missions/plan-reply.component';
import { PlaybooksComponent } from '../../shared/missions/playbooks.component';

/**
 * Missions in Ask TODD (design_handoff_todd_missions 1a-1d, 10a, 14a): ask
 * for something and get either an answer or a plan to start; or start from
 * a playbook. A started Mission lives in Moves. The screens are the shared
 * taliferro-ui/missions components.
 */
@Directive()
abstract class SignedInPage implements OnInit {
  protected readonly auth = inject( AuthService );
  readonly signedIn = signal<boolean | null>( null );
  readonly viewerId = signal( '' );

  ngOnInit (): void {
    this.auth.isLoggedIn().subscribe( ( yes ) => {
      this.signedIn.set( yes );
      if ( yes ) this.viewerId.set( this.auth.getCurrentUserIdSync() || '' );
    } );
  }
}

const STYLES = `
  :host { display: block; min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--font); }
  .page { max-width: 1100px; margin: 0 auto; padding: 28px 36px 64px; display: flex; flex-direction: column; gap: 20px; }
  .wide { max-width: 1280px; }
  .top { display: flex; align-items: center; gap: 14px; font-size: 14px; font-weight: 700; }
  .top a { color: var(--text); text-decoration: none; }
  .spacer { flex: 1; }
  h1 { margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.04em; }
  .signin { background: var(--surface); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .btn { height: 44px; padding: 0 22px; border-radius: 999px; background: var(--blue); color: #fff; font-weight: 700; display: inline-flex; align-items: center; text-decoration: none; }
  @media (max-width: 640px) { .page { padding: 20px 16px 48px; } }
`;

const SIGN_IN = `<div class="signin" data-cy="missions-signin"><b>Sign in to hand TODD work.</b><a class="btn" routerLink="/login">Sign in</a></div>`;

@Component( {
  selector: 'app-ask-missions-page',
  standalone: true,
  imports: [PlanReplyComponent, RouterLink],
  template: `
    <div class="page">
      <nav class="top"><a routerLink="/">Ask TODD</a><span class="spacer"></span><a routerLink="/playbooks" data-cy="to-playbooks">Playbooks</a></nav>
      <h1>What do you need done?</h1>
      @if (signedIn() === false) { ${SIGN_IN} }
      @if (signedIn()) {
        <tm-plan-reply [request]="q()" [origin]="playbook() ? 'playbook' : 'ask'" [playbookId]="playbook()" [viewerId]="viewerId()" detailBase="https://moves.taliferro.tech/missions/" />
      }
    </div>
  `,
  styles: [STYLES],
} )
export class AskMissionsPageComponent extends SignedInPage {
  private readonly route = inject( ActivatedRoute );
  readonly q = toSignal( this.route.queryParamMap.pipe( map( ( p ) => p.get( 'q' ) || '' ) ), { initialValue: '' } );
  readonly playbook = toSignal( this.route.queryParamMap.pipe( map( ( p ) => p.get( 'playbook' ) || '' ) ), { initialValue: '' } );
}

@Component( {
  selector: 'app-playbooks-page',
  standalone: true,
  imports: [PlaybooksComponent, RouterLink],
  template: `
    <div class="page wide">
      <nav class="top"><a routerLink="/">Ask TODD</a><span class="spacer"></span><a routerLink="/missions">Ask for something else</a></nav>
      @if (signedIn() === false) { ${SIGN_IN} }
      @if (signedIn()) { <tm-playbooks [viewerId]="viewerId()" (use)="use($event)" /> }
    </div>
  `,
  styles: [STYLES],
} )
export class PlaybooksPageComponent extends SignedInPage {
  private readonly router = inject( Router );

  use ( playbook: Playbook ): void {
    void this.router.navigate( ['/missions'], { queryParams: { q: playbook.request, playbook: playbook.id } } );
  }
}
