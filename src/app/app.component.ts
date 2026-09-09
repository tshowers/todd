import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommandPaletteComponent } from './shared/page/command-palette/command-palette.component';

@Component( {
  selector: 'ask-todd-root',
  standalone: true,
  imports: [RouterOutlet, CommandPaletteComponent],
  template: '<app-command-palette /><router-outlet />',
} )
export class AppComponent {}
