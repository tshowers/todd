import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommandPaletteResult, navigateToEntry, searchEntriesStrict, withIcons } from './command-palette-match';

/**
 * Global ⌘K / Ctrl+K search: jump to any route in this app or to any of the
 * other Taliferro apps. This is separate from the Ask TODD chat box's own
 * inline route-suggestion dropdown (todd.component.ts) - that one reacts to
 * free-form conversational text; this one is a deliberate keyboard shortcut
 * available from anywhere in the app. Both share the same entry list and
 * matching/navigation logic in command-palette-match.ts.
 */
@Component( {
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.css'
} )
export class CommandPaletteComponent {
  isOpen = false;
  query = '';
  results: CommandPaletteResult[] = [];
  activeIndex = 0;

  @ViewChild( 'paletteInput' ) private inputRef?: ElementRef<HTMLInputElement>;

  constructor ( private router: Router ) {
    this.results = withIcons( searchEntriesStrict( '' ) );
  }

  @HostListener( 'document:keydown', ['$event'] )
  onKeydown ( event: KeyboardEvent ): void {
    const key = event.key.toLowerCase();

    if ( ( event.metaKey || event.ctrlKey ) && key === 'k' ) {
      event.preventDefault();
      this.isOpen ? this.close() : this.open();
      return;
    }

    if ( !this.isOpen ) return;

    if ( key === 'escape' ) {
      event.preventDefault();
      this.close();
    } else if ( key === 'arrowdown' ) {
      event.preventDefault();
      this.activeIndex = Math.min( this.activeIndex + 1, this.results.length - 1 );
    } else if ( key === 'arrowup' ) {
      event.preventDefault();
      this.activeIndex = Math.max( this.activeIndex - 1, 0 );
    } else if ( key === 'enter' ) {
      event.preventDefault();
      this.selectActive();
    }
  }

  open (): void {
    this.isOpen = true;
    this.query = '';
    this.activeIndex = 0;
    this.results = withIcons( searchEntriesStrict( '' ) );
    setTimeout( () => this.inputRef?.nativeElement.focus(), 0 );
  }

  close (): void {
    this.isOpen = false;
  }

  onQueryChange (): void {
    this.activeIndex = 0;
    this.results = withIcons( searchEntriesStrict( this.query ) );
  }

  selectActive (): void {
    const entry = this.results[this.activeIndex];
    if ( entry ) this.select( entry );
  }

  select ( entry: CommandPaletteResult ): void {
    this.close();
    navigateToEntry( this.router, entry );
  }
}
