import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { SeoService } from '../../shared/seo.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
})
export class AboutComponent implements OnInit, OnDestroy {
  private schemaScript: HTMLScriptElement | null = null;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly renderer: Renderer2,
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly seo: SeoService,
  ) {}

  ngOnInit(): void {
    const pageTitle = 'About Ask TODD | Taliferro Tech';
    const description = 'TODD is a Momentum System: it connects contacts, emails, documents, feedback, tasks, and signals, then tells you what to do next.';
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: 'https://ask.taliferro.tech/about' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.seo.setCanonical('https://ask.taliferro.tech/about');
    this.addStructuredData();
  }

  ngOnDestroy(): void {
    this.schemaScript?.remove();
  }

  // Same shared Organization @id as the other products' About pages —
  // schema.org convention for "this is the same real-world entity".
  private addStructuredData(): void {
    this.schemaScript = this.renderer.createElement('script') as HTMLScriptElement;
    this.schemaScript.type = 'application/ld+json';
    this.schemaScript.id = 'about-structured-data';
    this.schemaScript.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://taliferro.com/#organization',
          name: 'Taliferro Tech, LLC',
          url: 'https://taliferro.com',
          description: 'Taliferro Tech creates software products that help people find information, build momentum, and act on useful context.',
        },
        {
          '@type': 'SoftwareApplication',
          '@id': 'https://ask.taliferro.tech/#software',
          name: 'Ask TODD',
          url: 'https://ask.taliferro.tech/',
          description: 'TODD is a Momentum System: it turns scattered information across relationships, tasks, and pipeline into a clear next move, instead of just storing history like a CRM.',
          applicationCategory: 'BusinessApplication',
          applicationSubCategory: 'Business intelligence',
          operatingSystem: 'Web',
          image: 'https://ask.taliferro.tech/assets/find/entities/todd/logo-icon.png',
          creator: { '@id': 'https://taliferro.com/#organization' },
          publisher: { '@id': 'https://taliferro.com/#organization' },
        },
      ],
    });
    this.renderer.appendChild(this.document.head, this.schemaScript);
  }
}
