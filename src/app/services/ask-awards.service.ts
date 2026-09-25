import { Injectable } from '@angular/core';

export type AskAwardIcon =
  | 'first-ask' | 'curious' | 'better-questions' | 'follow-up' | 'clarifier'
  | 'pattern-finder' | 'deep-diver' | 'thought-partner' | 'momentum-seeker' | 'ask-legend';

export type AskAwardState = 'unlocked' | 'locked' | 'mystery';

export interface AskAward {
  id: string;
  title: string;
  threshold: number;
  copy: string;
  icon: AskAwardIcon;
  hidden?: boolean;
}

export interface AskAwardView extends AskAward {
  state: AskAwardState;
}

export interface AskAwardsProgress {
  count: number;
  unlockedCount: number;
  totalCount: number;
  percent: number;
  nextAward: ( AskAward & { questionsToGo: number } ) | null;
}

interface UnlockedRecord {
  title: string;
  copy: string;
  icon: AskAwardIcon;
  unlockedAt: string;
}

const AWARD_LADDER: AskAward[] = [
  { id: 'first-ask', title: 'The First Ask', threshold: 1, icon: 'first-ask', copy: 'You turned a question into a next move.' },
  { id: 'curious-one', title: 'The Curious One', threshold: 3, icon: 'curious', copy: 'You are willing to look twice—and ask why.' },
  { id: 'better-questions', title: 'Better Questions', threshold: 6, icon: 'better-questions', copy: 'The quality of the question is starting to change the quality of the answer.' },
  { id: 'follow-up', title: 'The Follow-Up', threshold: 10, icon: 'follow-up', copy: 'You did not stop at the first answer. That is where useful thinking begins.' },
  { id: 'clarifier', title: 'The Clarifier', threshold: 15, icon: 'clarifier', copy: 'You know how to turn a vague problem into something you can work with.' },
  { id: 'pattern-finder', title: 'The Pattern Finder', threshold: 20, icon: 'pattern-finder', copy: 'You are connecting questions that used to feel separate.' },
  { id: 'deep-diver', title: 'The Deep Diver', threshold: 30, icon: 'deep-diver', copy: 'You keep going until the useful part is no longer buried.' },
  { id: 'thought-partner', title: 'The Thought Partner', threshold: 40, icon: 'thought-partner', copy: 'You are using TODD to think with you, not just answer you.' },
  { id: 'momentum-seeker', title: 'The Momentum Seeker', threshold: 60, icon: 'momentum-seeker', copy: 'Your questions consistently point toward movement.' },
  { id: 'ask-legend', title: 'The Ask Legend', threshold: 100, icon: 'ask-legend', hidden: true, copy: 'One hundred questions. You stopped waiting for clarity to find you.' },
];

@Injectable( { providedIn: 'root' } )
export class AskAwardsService {
  private readonly COUNT_KEY = 'ask-awards-count';
  private readonly UNLOCKED_KEY = 'ask-awards-unlocked';

  private count = 0;
  private unlocked = new Map<string, UnlockedRecord>();

  constructor () {
    this.load();
  }

  get questionCount (): number {
    return this.count;
  }

  get awards (): AskAwardView[] {
    return AWARD_LADDER.map( ( award ) => {
      const record = this.unlocked.get( award.id );
      if ( record ) return { ...award, title: record.title, copy: record.copy, state: 'unlocked' as const };
      return { ...award, state: ( award.hidden ? 'mystery' : 'locked' ) as AskAwardState };
    } );
  }

  get progress (): AskAwardsProgress {
    const trackable = AWARD_LADDER.filter( ( award ) => !award.hidden );
    const unlockedCount = trackable.filter( ( award ) => this.unlocked.has( award.id ) ).length;
    const nextLadderAward = trackable.find( ( award ) => !this.unlocked.has( award.id ) ) || null;
    return {
      count: this.count,
      unlockedCount,
      totalCount: AWARD_LADDER.length,
      percent: trackable.length ? Math.round( ( unlockedCount / trackable.length ) * 100 ) : 0,
      nextAward: nextLadderAward
        ? { ...nextLadderAward, questionsToGo: Math.max( 0, nextLadderAward.threshold - this.count ) }
        : null
    };
  }

  /** Call once after TODD successfully answers a user question. */
  recordQuestion (): AskAward | null {
    this.count += 1;
    this.save();

    let justUnlocked: AskAward | null = null;
    for ( const award of AWARD_LADDER ) {
      if ( this.unlocked.has( award.id ) || this.count < award.threshold ) continue;
      this.unlocked.set( award.id, {
        title: award.title,
        copy: award.copy,
        icon: award.icon,
        unlockedAt: new Date().toISOString()
      } );
      justUnlocked = award;
    }
    if ( justUnlocked ) this.save();
    return justUnlocked;
  }

  private load (): void {
    try {
      this.count = Number( localStorage.getItem( this.COUNT_KEY ) ) || 0;
    } catch {
      this.count = 0;
    }
    try {
      const raw = localStorage.getItem( this.UNLOCKED_KEY );
      const parsed: Record<string, UnlockedRecord> = raw ? JSON.parse( raw ) : {};
      this.unlocked = new Map( Object.entries( parsed ) );
    } catch {
      this.unlocked = new Map();
    }
  }

  private save (): void {
    try {
      localStorage.setItem( this.COUNT_KEY, String( this.count ) );
      localStorage.setItem( this.UNLOCKED_KEY, JSON.stringify( Object.fromEntries( this.unlocked ) ) );
    } catch { /* local-only progress is best effort */ }
  }
}
