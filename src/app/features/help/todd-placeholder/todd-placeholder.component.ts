import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component( {
  selector: 'app-todd-placeholder',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  template: `
    <div class="todd-placeholder">
      <img class="todd-placeholder-logo" src="assets/TODD-icon.png" alt="TODD">
      <h1>Ask TODD is moving here</h1>
      <p>This is the new home for TODD's chat, currently mid-migration from todd.taliferro.tech. The full experience lands in the next pass.</p>
      <p class="todd-placeholder-auth">{{ (isLoggedIn$ | async) ? 'Signed in on this domain.' : 'Not signed in on this domain yet — sign-in lands with the full chat experience.' }}</p>
    </div>
  `,
  styleUrl: './todd-placeholder.component.css'
} )
export class ToddPlaceholderComponent {
  private readonly authService = inject( AuthService );
  readonly isLoggedIn$ = this.authService.getUser().pipe( map( user => !!user ) );
}
