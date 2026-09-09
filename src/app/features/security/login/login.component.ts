import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="login-shell">
      <section class="login-card">
        <img src="assets/TODD-icon.png" alt="TODD" class="login-logo" />
        <h1>Sign in to TODD</h1>
        <p>Use your shared TODD account to continue.</p>
        <button type="button" (click)="signInWithGoogle()" [disabled]="busy">{{ busy ? 'Signing in…' : 'Continue with Google' }}</button>
        <div class="login-divider">or use email</div>
        <form (ngSubmit)="sendEmailLink()">
          <input type="email" name="email" [(ngModel)]="email" required autocomplete="email" placeholder="you@example.com" aria-label="Email address" />
          <button type="submit" [disabled]="busy || !email">{{ busy ? 'Sending…' : 'Email me a sign-in link' }}</button>
        </form>
        <p class="login-message" *ngIf="message">{{ message }}</p>
      </section>
    </main>
  `,
  styles: [`:host{display:block;min-height:100vh;background:#f7f9fc;color:#101828}.login-shell{min-height:100vh;display:grid;place-items:center;padding:24px}.login-card{width:min(390px,100%);padding:34px;border:1px solid #d9dee7;border-radius:20px;background:#fff;box-shadow:0 24px 70px #0b12201a;text-align:center}.login-logo{width:64px;height:64px;object-fit:contain;margin-bottom:12px}.login-card h1{margin:0 0 8px}.login-card p{color:#667085}.login-card button{width:100%;padding:12px 16px;border:0;border-radius:10px;background:#111827;color:#fff;font-weight:700;cursor:pointer}.login-card button:disabled{opacity:.55;cursor:default}.login-divider{margin:22px 0 12px;color:#98a2b3;font-size:.85rem}.login-card input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #d0d5dd;border-radius:10px;margin-bottom:10px}.login-message{margin-top:16px!important;font-size:.9rem}.login-message:empty{display:none}`]
})
export class LoginComponent implements OnInit {
  email = '';
  busy = false;
  message = '';
  private client: string | null = null;
  private state: string | null = null;
  private finishLink = false;

  constructor(private readonly authService: AuthService, private readonly route: ActivatedRoute, private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    this.client = this.route.snapshot.queryParamMap.get('client');
    this.state = this.route.snapshot.queryParamMap.get('state');
    this.finishLink = this.router.url.split('?')[0] === '/finish-sign-in';
    if (this.finishLink) {
      try {
        const user = await firstValueFrom(this.authService.verifyLink());
        if (user) await this.completeSignIn(user);
      } catch (error: any) { this.message = error?.message || 'That sign-in link is invalid or expired.'; }
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.busy = true;
    try { const user = await this.authService.signInWithGoogle(); if (user) await this.completeSignIn(user); }
    catch (error: any) { this.message = error?.message || 'Sign-in failed. Please try again.'; this.busy = false; }
  }

  sendEmailLink(): void {
    this.busy = true;
    const redirect = `${environment.PLATFORM_URL}/finish-sign-in${this.buildQuery()}`;
    this.authService.sendLoginLinkWithRedirect(this.email.trim(), redirect).subscribe({
      next: () => { this.message = 'Check your email for a secure sign-in link.'; this.busy = false; },
      error: (error) => { this.message = error?.message || 'Unable to send the sign-in link.'; this.busy = false; }
    });
  }

  private buildQuery(): string {
    const params = new URLSearchParams();
    if (this.client) params.set('client', this.client);
    if (this.state) params.set('state', this.state);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  private async completeSignIn(user: any): Promise<void> {
    if (!this.client) { await this.router.navigateByUrl('/'); return; }
    const idToken = await user.getIdToken(true);
    const response = await fetch(`${environment.backendURL}/public/auth/mobile-session-token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, client: this.client }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success || !payload?.customToken || !payload?.redirectUri) throw new Error(payload?.message || 'Unable to complete sign-in for this app.');
    const callback = new URL(payload.redirectUri);
    callback.searchParams.set('token', payload.customToken);
    if (this.state) callback.searchParams.set('state', this.state);
    window.location.href = callback.toString();
  }
}
