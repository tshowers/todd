import { SEARCH_ENTRIES, SEARCH_SITE_NAMES, SearchEntry, searchEntryUrl } from '@taliferro/ui/platform/search-index.model';

export interface CommandPaletteEntry {
  id: string;
  label: string;
  group: string;
  path: string;
  queryParams?: Record<string, string>;
  keywords: string[];
  /** Overrides the group-based icon lookup for this specific entry. */
  icon?: string;
  /** True when `path` is a full URL to navigate to directly rather than an internal Angular route. */
  external?: boolean;
  /** For external entries only: open in a new tab instead of the current one. */
  newTab?: boolean;
}

/**
 * Ask TODD's as-you-type navigation (features/help/todd) uses this list.
 * It comes from the same index as the ⌘K search
 * (@taliferro/ui/platform/search-index.model), so there is one list of
 * pages to keep current. Every page is a full URL (navigateToEntry loads
 * it), except Ask TODD's own home ('/'), which routes in place. Groups
 * match command-palette-match's icons.
 */
const GROUP_BY_SITE: Partial<Record<SearchEntry['site'], string>> = {
  todd: 'Home',
  network: 'Network',
  outreach: 'Outreach',
  moves: 'Moves',
  docs: 'Docs',
  pulse: 'Pulse',
  social: 'Social',
};

const ICON_BY_SITE: Partial<Record<SearchEntry['site'], string>> = {
  'ask-todd': '/assets/TODD-icon.png',
  'maya': '/assets/marketing/marketing-director-avatar.png',
  'find': '/assets/find-logo.png',
  'lead-vault': '/assets/lead-vault/lead-vault.png',
  'sayit': '/assets/sayit/sayit-logo.png',
  'email-signature': '/assets/outreach/email-signature-builder.png',
  'music': '/assets/taliferro-music.jpg',
};

function toPaletteEntry ( entry: SearchEntry ): CommandPaletteEntry {
  const inApp = entry.site === 'ask-todd' && entry.path === '/';
  return {
    id: `${ entry.site }:${ entry.path }`,
    label: entry.label,
    group: entry.access ? 'Admin' : GROUP_BY_SITE[entry.site] || SEARCH_SITE_NAMES[entry.site],
    path: inApp ? '/' : searchEntryUrl( entry ),
    keywords: ( entry.keywords || '' ).split( /\s+/ ).filter( Boolean ),
    ...( ICON_BY_SITE[entry.site] ? { icon: ICON_BY_SITE[entry.site] } : {} ),
    ...( inApp ? {} : { external: true } ),
    ...( entry.site === 'music' || entry.site === 'company' ? { newTab: true } : {} ),
  };
}

/**
 * Ask TODD suggests pages while people are asking it real questions, so it
 * leaves out every other product's help/about/pricing-style pages (their
 * generic "help" keywords turned questions like "I need help writing an
 * email" into page suggestions) and the admin pages (admins have ⌘K).
 */
const CHAT_SKIPPED_PATHS = new Set( ['/help', '/about', '/pricing', '/get-started', '/ios', '/support'] );

function suggestInChat ( entry: SearchEntry ): boolean {
  if ( entry.access ) return false;
  return entry.site === 'todd' || !CHAT_SKIPPED_PATHS.has( entry.path );
}

export const COMMAND_PALETTE_ENTRIES: CommandPaletteEntry[] = SEARCH_ENTRIES.filter( suggestInChat ).map( toPaletteEntry );
