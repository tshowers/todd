export type ToddMediaOrientation = 'short' | 'wide';

export interface ToddMediaItem {
    module_id: string;
    type: string;
    best_for: string[];
    url: string;
    description: string;
    orientation: ToddMediaOrientation;
    keywords: string[];
    why: string;
}

function deriveOrientation ( url: string ): ToddMediaOrientation {
    return /youtube\.com\/shorts\//i.test( url ) ? 'short' : 'wide';
}

function deriveKeywords ( item: { module_id: string; best_for: string[]; description: string; type: string; } ): string[] {
    const parts = [
        item.module_id,
        ...( item.best_for || [] ),
        item.description || '',
        item.type || ''
    ];

    const text = parts.join( ' ' ).toLowerCase();
    const normalized = text
        .replace( /[^a-z0-9\s]/g, ' ' )
        .split( /\s+/ )
        .map( token => token.trim() )
        .filter( Boolean );

    return Array.from( new Set( normalized ) );
}

function deriveWhy ( item: { best_for: string[]; description: string; type: string; } ): string {
    const bucket = item.best_for?.[0] || 'all';

    switch ( bucket ) {
        case 'outreach':
            return 'This video shows how 16Ahead helps create momentum with outreach and follow-through.';
        case 'moves':
            return 'This video shows how 16Ahead keeps work from stalling and helps you follow through.';
        case 'pulse':
            return 'This video shows how 16Ahead helps turn customer feedback into something useful.';
        case 'lead_vault':
            return 'This video shows how 16Ahead helps surface buyers and lead opportunities faster.';
        case 'knowledge':
            return 'This video shows how 16Ahead helps you reuse what you already know instead of starting over.';
        case 'docs':
            return 'This video shows how 16Ahead helps keep document-heavy work moving.';
        case 'ai':
            return 'This video shows how 16Ahead uses AI to move work forward, not just generate text.';
        default:
            if ( item.type === 'testimonial' ) {
                return 'This testimonial shows what it feels like when 16Ahead removes friction from the work.';
            }
            return 'This video helps explain how 16Ahead removes friction and keeps work moving.';
    }
}

function enrichMedia<T extends { module_id: string; type: string; best_for: string[]; url: string; description: string; }> ( items: T[] ): ToddMediaItem[] {
    return items.map( item => ( {
        ...item,
        orientation: deriveOrientation( item.url ),
        keywords: deriveKeywords( item ),
        why: deriveWhy( item )
    } ) );
}

type RawToddMedia = Omit<ToddMediaItem, 'orientation' | 'keywords' | 'why'>;

// Emptied for the 16Ahead rebrand until new videos are recorded. With no
// entries the assistant just doesn't suggest a video; add them back here.
export const RAW_VIDEOS: RawToddMedia[] = [];

export const RAW_TESTIMONIALS: RawToddMedia[] = [];

export const VIDEOS: ToddMediaItem[] = enrichMedia( RAW_VIDEOS );
export const TESTIMONIALS: ToddMediaItem[] = enrichMedia( RAW_TESTIMONIALS );