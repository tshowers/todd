import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { CommandPaletteComponent } from './shared/page/command-palette/command-palette.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';

@Component( {
  selector: 'ask-todd-root',
  standalone: true,
  imports: [RouterOutlet, CommandPaletteComponent, PlatformMenuComponent, AsyncPipe],
  template: '<app-platform-menu [isAdmin]="(isAdmin$ | async) ?? false" /><app-command-palette /><router-outlet />',
} )
export class AppComponent {
  private readonly authService = inject( AuthService );
  readonly isAdmin$ = this.authService.getUser().pipe( map( user => user?.uid === environment.taliferroTenantId ) );
}
