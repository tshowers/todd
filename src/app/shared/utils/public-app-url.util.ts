import { environment } from '../../../environments/environment';

function getWindowLocation (): Location | null {
  if ( typeof window === 'undefined' || !window.location ) {
    return null;
  }

  return window.location;
}

function getHostname (): string {
  const location = getWindowLocation();
  return String( location?.hostname || '' ).trim().toLowerCase();
}

function getOrigin (): string {
  const location = getWindowLocation();
  return String( location?.origin || environment.PLATFORM_URL || '' ).trim().replace( /\/$/, '' );
}

function isStagingHost (): boolean {
  const hostname = getHostname();
  return hostname === 'staging.taliferro.tech'
    || hostname === 'staging.16ahead.com'
    || hostname === 'todd-staging.web.app';
}

function isSayitHost (): boolean {
  const hostname = getHostname();
  return hostname === 'sayit.taliferro.tech'
    || hostname === 'sayit.16ahead.com'
    || hostname === 'todd-sayit.web.app';
}

export function getToddHomeUrl (): string {
  if ( isStagingHost() ) {
    return getOrigin();
  }

  return String( environment.PLATFORM_URL || 'https://app.16ahead.com' )
    .trim()
    .replace( /\/$/, '' );
}

export function getFindHomeUrl (): string {
  return 'https://find.16ahead.com';
}

export function getSignatureBuilderUrl (): string {
  return 'https://signature.16ahead.com';
}

export function getMayaHomeUrl (): string {
  return 'https://marketing.16ahead.com';
}

export function getLeadVaultHomeUrl (): string {
  return 'https://lead-vault.16ahead.com';
}

export function getNetworkHomeUrl (): string {
  return 'https://network.16ahead.com';
}

export function getPulseHomeUrl (): string {
  return 'https://pulse.16ahead.com';
}

export function getOutreachHomeUrl (): string {
  return 'https://outreach.16ahead.com';
}

export function getMovesHomeUrl (): string {
  return 'https://moves.16ahead.com';
}

export function getSocialHomeUrl (): string {
  return 'https://social.16ahead.com';
}

export function getDocsHomeUrl (): string {
  return 'https://docs.16ahead.com';
}

/**
 * TODD's chat carries a lot of internal-route strings (e.g. '/network/app',
 * 'compose-email') inherited from the monolith, where they resolve on the
 * same origin. This app has no such routes of its own, so every one of them
 * has to resolve to an external origin instead: Network/Pulse got their own
 * extracted homes, everything else still only exists at todd.taliferro.tech.
 */
export function resolveExternalAppUrl ( path: string ): string {
  const trimmed = String( path || '' ).trim();
  if ( !trimmed ) return getToddHomeUrl();
  if ( /^https?:\/\//i.test( trimmed ) ) return trimmed;

  const normalized = trimmed.startsWith( '/' ) ? trimmed : `/${trimmed}`;

  if ( normalized === '/network' || normalized.startsWith( '/network/' ) ) {
    return `${getNetworkHomeUrl()}${normalized.slice( '/network'.length )}`;
  }

  if ( normalized === '/pulse' || normalized.startsWith( '/pulse/' ) ) {
    return `${getPulseHomeUrl()}${normalized.slice( '/pulse'.length )}`;
  }

  if ( normalized === '/outreach' || normalized.startsWith( '/outreach/' ) ) {
    return `${getOutreachHomeUrl()}${normalized.slice( '/outreach'.length )}`;
  }

  if ( normalized === '/moves' || normalized.startsWith( '/moves/' ) ) {
    return `${getMovesHomeUrl()}${normalized.slice( '/moves'.length )}`;
  }

  if ( normalized === '/social' || normalized.startsWith( '/social/' ) ) {
    return `${getSocialHomeUrl()}${normalized.slice( '/social'.length )}`;
  }

  if ( normalized === '/docs' || normalized.startsWith( '/docs/' ) ) {
    return `${getDocsHomeUrl()}${normalized.slice( '/docs'.length )}`;
  }

  return `${getToddHomeUrl()}${normalized}`;
}

export function getSayitHomeUrl (): string {
  if ( isSayitHost() ) {
    return getOrigin();
  }

  if ( isStagingHost() ) {
    return `${getOrigin()}/say-it/app`;
  }

  return 'https://sayit.16ahead.com';
}

export function buildSayitShareUrl (
  queryKey: 'post' | 'news',
  queryValue: string
): string {
  const normalizedValue = String( queryValue || '' ).trim();
  if ( !normalizedValue ) {
    return getSayitHomeUrl();
  }

  const url = new URL( getSayitHomeUrl() );
  url.searchParams.set( queryKey, normalizedValue );
  return url.toString();
}
