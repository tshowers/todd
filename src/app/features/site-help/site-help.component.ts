import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { ProductPagesComponent } from '../../shared/product-pages/product-pages.component';

/**
 * Ask TODD's Help: the shared Help template, then the full TODD setup
 * walkthrough and more questions below it. Static (prerendered).
 */
@Component( {
  selector: 'app-site-help',
  standalone: true,
  imports: [CommonModule, ProductPagesComponent],
  templateUrl: './site-help.component.html',
} )
export class SiteHelpComponent {
  readonly setup = [
    { step: '1', title: 'Sign in', copy: 'TODD needs to know who you are and which workspace to use before it can help with your own work.' },
    { step: '2', title: 'Update your profile', copy: 'Tell TODD who you are and what you do, so its guidance fits your actual work.' },
    { step: '3', title: 'Set up your sending address', copy: 'If your workspace uses Outreach, TODD needs a provisioned sending address before it can send anything on your behalf.' },
    { step: '4', title: 'Add or import your contacts', copy: 'TODD connects contacts, emails, documents, feedback, tasks and signals. The more it can see, the sharper its answers.' },
  ];

  readonly goodQuestions = [
    { q: 'What is TODD?', why: 'The short version, with a diagram of how TODD turns information into next moves.' },
    { q: 'How can TODD help me?', why: 'What changes when contacts, emails, documents and signals are connected.' },
    { q: 'What is a Momentum System?', why: 'The idea TODD is built around.' },
    { q: 'How is TODD different from a CRM?', why: 'Why storing history isn’t the same as knowing what to do next.' },
    { q: 'How do I get started?', why: 'The setup steps, in order.' },
  ];

  readonly questions = [
    { q: 'Is Ask TODD free?', a: 'Yes. Ask as many questions as you like, signed in or not.' },
    { q: 'Is my conversation saved?', a: 'While you are signed in, your conversation is saved automatically and will be here when you come back.' },
    { q: 'Can I keep an answer?', a: 'Choose Copy under an answer, or Download for the whole conversation as a text file.' },
    { q: 'What are Awards?', a: 'Awards you unlock by asking good questions. Some stay hidden until you find them. Open them from the menu.' },
    { q: 'Where do I change my profile or settings?', a: 'On the TODD site. Your name in the menu opens your profile; Settings and Daily Momentum are in the menu too.' },
    { q: 'Which apps are part of TODD?', a: 'Network, Outreach, Moves, Pulse, Social, Docs, Lead Vault, Maya, Find and more. They are all in the menu.' },
  ];
}
