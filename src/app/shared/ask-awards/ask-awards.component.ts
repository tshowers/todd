import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AskAward, AskAwardIcon, AskAwardState, AskAwardsProgress, AskAwardsService } from '../../services/ask-awards.service';

@Component( {
  selector: 'app-ask-awards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ask-awards.component.html',
  styleUrl: './ask-awards.component.css'
} )
export class AskAwardsComponent {
  @Input() pendingAward: AskAward | null = null;
  @Input() overlayOnly = false;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly dismissUnlock = new EventEmitter<void>();

  constructor ( private readonly awardsService: AskAwardsService ) { }

  get awards () { return this.awardsService.awards; }
  get progress (): AskAwardsProgress { return this.awardsService.progress; }

  iconClass ( icon: AskAwardIcon ): string {
    const icons: Record<AskAwardIcon, string> = {
      'first-ask': 'fa-solid fa-comment',
      curious: 'fa-solid fa-circle-question',
      'better-questions': 'fa-solid fa-lightbulb',
      'follow-up': 'fa-solid fa-arrow-turn-up',
      clarifier: 'fa-solid fa-crosshairs',
      'pattern-finder': 'fa-solid fa-share-nodes',
      'deep-diver': 'fa-solid fa-water',
      'thought-partner': 'fa-solid fa-people-arrows',
      'momentum-seeker': 'fa-solid fa-bolt',
      'ask-legend': 'fa-solid fa-crown'
    };
    return icons[icon];
  }

  stateClass ( state: AskAwardState ): string {
    return `ask-award-card--${state}`;
  }

  dismiss (): void {
    this.dismissUnlock.emit();
  }
}
