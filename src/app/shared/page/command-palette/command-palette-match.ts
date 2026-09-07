import { Router } from '@angular/router';
import { COMMAND_PALETTE_ENTRIES, CommandPaletteEntry } from './command-palette-entries';
import { resolveExternalAppUrl } from '../../utils/public-app-url.util';

// Words too short/common to mean anything on their own (chat sentences are
// full of these - "take me to network" shouldn't fail to match "network").
// "todd" is here too: this matching only runs on the Ask TODD page, where
// the assistant's own name appears in nearly every message ("What is
// TODD?", "How can TODD help me?") without being a navigation signal.
const STOPWORDS = new Set( [
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'is', 'it', 'me', 'my', 'go',
  'and', 'or', 'for', 'at', 'be', 'do', 'i', 'you', 'we', 'take', 'open',
  'show', 'find', 'get', 'can', 'how', 'what', 'where', 'please', 'todd',
] );

function tokenize ( query: string ): string[] {
  return query.trim().toLowerCase().split( /\s+/ )
    .map( word => word.replace( /^[^a-z0-9]+|[^a-z0-9]+$/g, '' ) )
    .filter( Boolean );
}

function isSignificant ( word: string ): boolean {
  return word.length >= 3 && !STOPWORDS.has( word );
}

function isSubsequence ( needle: string, haystack: string ): boolean {
  let i = 0;
  for ( let j = 0; j < haystack.length && i < needle.length; j++ ) {
    if ( haystack[j] === needle[i] ) i++;
  }
  return i === needle.length;
}

function wordScoreAgainst ( word: string, haystacks: string[] ): number {
  let best = 0;
  for ( const haystack of haystacks ) {
    if ( haystack === word ) best = Math.max( best, 100 );
    else if ( haystack.startsWith( word ) ) best = Math.max( best, 80 );
    else if ( haystack.includes( word ) ) best = Math.max( best, 60 );
    // Fuzzy/typo tolerance only against a single-word haystack ("network",
    // "operator"): scattering a word's letters across a multi-word phrase
    // ("taliferro music", "approve profiles") produces coincidental matches
    // with no real relationship to what was typed.
    else if ( word.length >= 3 && !haystack.includes( ' ' ) && isSubsequence( word, haystack ) ) best = Math.max( best, 15 );
  }
  return best;
}

function haystacksFor ( entry: CommandPaletteEntry ): string[] {
  return [entry.label, entry.group, ...entry.keywords].map( h => h.toLowerCase() );
}

// Loose matching deliberately leaves the group name out: broad category
// names ("Daily Momentum") share ordinary words with unrelated keywords on
// other entries in the same group (e.g. "system status"'s "system" plus
// "Daily Momentum"'s "momentum" would otherwise look like two real matches
// for a sentence that just happens to contain both words).
function looseHaystacksFor ( entry: CommandPaletteEntry ): string[] {
  return [entry.label, ...entry.keywords].map( h => h.toLowerCase() );
}

/**
 * Every word in the query must match something (label/group/keyword) on the
 * entry. Suited to a deliberate short "go to X" query typed into a command
 * palette, where every word is meant to narrow the result.
 */
function scoreEntryStrict ( entry: CommandPaletteEntry, words: string[] ): number {
  const haystacks = haystacksFor( entry );
  let total = 0;
  for ( const word of words ) {
    const score = wordScoreAgainst( word, haystacks );
    if ( score === 0 ) return 0;
    total += score;
  }
  return total;
}

interface LooseScore {
  score: number;
  matchedCount: number;
}

/**
 * At least one non-stopword must match well; other words are ignored rather
 * than zeroing the score. Suited to free-form conversational text ("take me
 * to network" / "how do I get to operator controls") where most words carry
 * no navigational meaning.
 */
function scoreEntryLoose ( entry: CommandPaletteEntry, words: string[] ): LooseScore {
  const haystacks = looseHaystacksFor( entry );
  let total = 0;
  let matchedCount = 0;
  for ( const word of words ) {
    if ( !isSignificant( word ) ) continue;
    const score = wordScoreAgainst( word, haystacks );
    if ( score > 0 ) {
      total += score;
      matchedCount++;
    }
  }
  return { score: matchedCount > 0 ? total : 0, matchedCount };
}

function rank ( scored: Array<{ entry: CommandPaletteEntry; score: number; }>, limit: number ): CommandPaletteEntry[] {
  return scored
    .sort( ( a, b ) => b.score - a.score )
    .slice( 0, limit )
    .map( s => s.entry );
}

export function searchEntriesStrict ( query: string, limit = 8 ): CommandPaletteEntry[] {
  const words = tokenize( query );
  if ( !words.length ) return COMMAND_PALETTE_ENTRIES.slice( 0, limit );

  const scored = COMMAND_PALETTE_ENTRIES
    .map( entry => ( { entry, score: scoreEntryStrict( entry, words ) } ) )
    .filter( s => s.score > 0 );

  return rank( scored, limit );
}

/** Minimum combined score before a loose match is considered worth surfacing. */
const LOOSE_MATCH_THRESHOLD = 60;

export function searchEntriesLoose ( query: string, limit = 5 ): CommandPaletteEntry[] {
  const words = tokenize( query );
  if ( !words.length ) return [];

  // A real sentence carries several meaningful words ("What is a Momentum
  // System?"); one of them incidentally matching a keyword ("momentum") is
  // not enough to assume navigational intent. A short phrase ("network",
  // "operator controls") only has one or two meaningful words total, so a
  // single strong match there is exactly the signal we want.
  const significantWordCount = words.filter( isSignificant ).length;
  const minMatchedWords = significantWordCount >= 2 ? 2 : 1;

  const scored = COMMAND_PALETTE_ENTRIES
    .map( entry => ( { entry, ...scoreEntryLoose( entry, words ) } ) )
    .filter( s => s.score >= LOOSE_MATCH_THRESHOLD && s.matchedCount >= minMatchedWords );

  return rank( scored, limit );
}

const GROUP_ICONS: Record<string, string> = {
  'Home': '/assets/TODD-icon.png',
  'Daily Momentum': '/assets/todd-momentum-icon.png',
  'Network': '/assets/todd-network-icon.png',
  'Outreach': '/assets/todd-outreach-icon.png',
  'Signal Engine': '/assets/todd-signal-engine-icon.png',
  'Moves': '/assets/todd-moves-icon.png',
  'Docs': '/assets/todd-docs-icon.png',
  'Pulse': '/assets/todd-pulse-icon.png',
  'Social': '/assets/todd-social-icon.png',
  'Admin': '/assets/icons/settings.png',
  'Settings': '/assets/icons/settings.png',
};

const DEFAULT_ICON = '/assets/TODD-icon.png';

export function getEntryIcon ( entry: CommandPaletteEntry ): string {
  return entry.icon || GROUP_ICONS[entry.group] || DEFAULT_ICON;
}

export type CommandPaletteResult = CommandPaletteEntry & { icon: string; };

export function withIcons ( entries: CommandPaletteEntry[] ): CommandPaletteResult[] {
  return entries.map( entry => ( { ...entry, icon: getEntryIcon( entry ) } ) );
}

/**
 * These entries are copied from the monolith's own route index, where every
 * `path` resolves on the same origin. ask-todd has no internal routes of its
 * own beyond '/', so every entry navigates externally here — Network/Pulse
 * to their own extracted homes, everything else back to todd.taliferro.tech
 * (see resolveExternalAppUrl). `router` is accepted only to keep this a
 * drop-in match for the monolith's call sites; it is unused here.
 */
export function navigateToEntry ( _router: Router, entry: CommandPaletteEntry ): void {
  if ( entry.path === '/ask-todd' || entry.path === '/' ) {
    void _router.navigate( ['/'] );
    return;
  }

  let url = resolveExternalAppUrl( entry.path );
  if ( entry.queryParams && Object.keys( entry.queryParams ).length ) {
    const parsed = new URL( url );
    for ( const [key, value] of Object.entries( entry.queryParams ) ) {
      parsed.searchParams.set( key, value );
    }
    url = parsed.toString();
  }

  if ( entry.newTab ) window.open( url, '_blank', 'noopener' );
  else window.location.href = url;
}
