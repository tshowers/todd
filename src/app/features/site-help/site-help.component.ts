import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { SeoService } from '../../shared/seo.service';

interface HelpStep {
  number: string;
  title: string;
  copy: string;
  details: string[];
}

@Component({
  selector: 'app-site-help',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './site-help.component.html',
  styleUrl: './site-help.component.css',
})
export class SiteHelpComponent implements OnInit {
  constructor(
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly seo: SeoService,
  ) {}

  ngOnInit(): void {
    const pageTitle = 'Help — Ask TODD';
    const description = 'How to get started with TODD: sign in, complete your profile, add your contacts, then ask TODD what needs to move next.';
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: 'https://ask.taliferro.tech/help' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.seo.setCanonical('https://ask.taliferro.tech/help');
  }

  readonly steps: HelpStep[] = [
    {
      number: '01',
      title: 'Sign in',
      copy: 'TODD needs to know who you are and which workspace to use before it can help.',
      details: [],
    },
    {
      number: '02',
      title: 'Update your profile',
      copy: 'Tell TODD who you are and what you do, so its guidance fits your actual work.',
      details: [],
    },
    {
      number: '03',
      title: 'Provision your email address (if using Outreach)',
      copy: 'If your workspace uses Outreach, TODD needs a provisioned sending address before it can send anything on your behalf.',
      details: [],
    },
    {
      number: '04',
      title: 'Add or import your contacts',
      copy: 'TODD connects contacts, emails, documents, feedback, tasks, and signals — the more it can see, the sharper its answers.',
      details: [],
    },
    {
      number: '05',
      title: 'Ask TODD anything',
      copy: 'Ask in plain language. A few good starting points:',
      details: [
        '"What is TODD?"',
        '"How can TODD help me?"',
        '"What is a Momentum System?"',
      ],
    },
  ];
}
