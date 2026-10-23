import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { NgModel } from '@angular/forms';
import { Subscription } from 'rxjs';

/**
 * Grows a textarea with its content so wrapped lines stay visible. The
 * ceiling comes from the textarea's own CSS max-height; past it, it scrolls.
 * Also re-measures on ngModel changes so a programmatic clear (after send)
 * shrinks it back to one line.
 */
@Directive({
  selector: 'textarea[appAutoGrow]',
  standalone: true,
})
export class AutoGrowDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);
  private readonly ngModel = inject(NgModel, { optional: true, self: true });
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private sub?: Subscription;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.sub = this.ngModel?.valueChanges?.subscribe(() => requestAnimationFrame(() => this.resize()));
    this.resize();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  @HostListener('input')
  resize(): void {
    if (!this.isBrowser) return;
    const textarea = this.el.nativeElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
}
