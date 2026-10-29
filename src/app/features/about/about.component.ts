import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { ProductPagesComponent } from '../../shared/product-pages/product-pages.component';

/**
 * About Ask TODD: the shared About template, then what TODD is, what it
 * connects, and the TODD family. Static (prerendered for search engines).
 */
@Component( {
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, ProductPagesComponent],
  templateUrl: './about.component.html',
} )
export class AboutComponent {
  readonly connects = [
    { title: 'People', copy: 'Who you know, who matters right now, and who has gone quiet.' },
    { title: 'Conversations', copy: 'Emails and replies, and the follow-ups they call for.' },
    { title: 'Knowledge', copy: 'Documents, proposals and the reference material your work depends on.' },
    { title: 'Work in motion', copy: 'Tasks, moves and the plans they belong to.' },
    { title: 'Feedback', copy: 'What customers and teams are actually saying.' },
    { title: 'Signals', copy: 'Clicks, replies, silence and activity: the hints that something should move.' },
  ];

  readonly family = [
    { name: 'Network', url: 'https://network.16ahead.com', line: 'Know who matters before the moment passes.' },
    { name: 'Outreach', url: 'https://outreach.16ahead.com', line: 'Keep the work moving.' },
    { name: 'Moves', url: 'https://moves.16ahead.com', line: 'Make progress visible and actionable.' },
    { name: 'Pulse', url: 'https://pulse.16ahead.com', line: 'Hear what people are really saying.' },
    { name: 'Social', url: 'https://social.16ahead.com', line: 'Stay visible without living online.' },
    { name: 'Docs', url: 'https://docs.16ahead.com', line: 'Documents, proposals and knowledge in one place.' },
    { name: 'Lead Vault', url: 'https://lead-vault.16ahead.com', line: 'Find the people behind the opportunity.' },
    { name: 'Marketing Assistant', url: 'https://marketing.16ahead.com', line: 'Think like your marketing director.' },
    { name: 'Find', url: 'https://find.16ahead.com', line: 'Get to the answer faster.' },
  ];
}
