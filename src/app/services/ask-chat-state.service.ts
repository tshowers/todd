import { Injectable } from '@angular/core';

interface AskChat {
  hasConversation: () => boolean;
  newQuestion: () => void;
  openSaved: () => void;
}

/**
 * Lets the header (in the app shell) act on the conversation on the home
 * page: New question and Saved. The chat registers itself while on screen.
 */
@Injectable( { providedIn: 'root' } )
export class AskChatStateService {
  private chat: AskChat | null = null;

  register ( chat: AskChat ): void { this.chat = chat; }
  unregister (): void { this.chat = null; }

  get hasConversation (): boolean { return !!this.chat?.hasConversation(); }
  newQuestion (): void { this.chat?.newQuestion(); }
  openSaved (): void { this.chat?.openSaved(); }
}
