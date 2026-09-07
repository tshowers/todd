import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { StatusLedComponent, StatusLedTone } from '../status-led/status-led.component';

export type ToddSystemOutcomeTone = 'positive' | 'ready' | 'info' | 'attention' | 'warn' | 'idle';

export interface ToddSystemOutcomeRow {
  id: string;
  moduleLabel: string;
  stateLabel: string;
  summary: string;
  detail: string;
  tone: ToddSystemOutcomeTone;
  toneClass: string;
  actionLabel: string | null;
  route: string | null;
}

@Component( {
  selector: 'app-todd-system-outcomes',
  standalone: true,
  imports: [CommonModule, StatusLedComponent],
  templateUrl: './todd-system-outcomes.component.html',
  styleUrl: './todd-system-outcomes.component.css'
} )
export class ToddSystemOutcomesComponent {
  @Input() rows: ToddSystemOutcomeRow[] = [];
  @Input() kicker = 'System outcomes';
  @Input() title = 'Status';

  @Output() routeSelected = new EventEmitter<string>();

  trackById ( _index: number, row: ToddSystemOutcomeRow ): string {
    return row.id;
  }

  getStatusLedTone ( tone: ToddSystemOutcomeTone ): StatusLedTone {
    if ( tone === 'ready' ) return 'positive';
    return tone;
  }

  onRouteSelected ( route: string | null ): void {
    const target = String( route || '' ).trim();
    if ( !target ) return;
    this.routeSelected.emit( target );
  }
}
