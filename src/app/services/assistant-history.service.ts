import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { environment } from '../../environments/environment';
import { Firestore } from '@angular/fire/firestore';
import { collection, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { LoggerService } from './logger.service';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;

  // Visibility controls for social proof / sharing
  // If missing, treat as INTERNAL.
  isPublic?: boolean;
  visibility?: 'public' | 'internal';
  audience?: 'public' | 'internal' | 'tenant';
  displayName?: string;
  userName?: string;
  conversationId?: string;
}

export interface AssistantConversation {
  id: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  title?: string;
}

@Injectable( {
  providedIn: 'root'
} )
export class AssistantHistoryService {

  private activeConversation: AssistantConversation | null = null;

  constructor ( private dataService: DataService, private firestore: Firestore, private logger: LoggerService ) { }

  /**
   * Resolve or create the active conversation for the current user.
   * Uses tenant+user to scope.
   */
  async getOrCreateActiveConversation ( userId: string ): Promise<AssistantConversation> {
    if ( this.activeConversation ) {
      return this.activeConversation;
    }

    // Pull all conversations for this tenant, then filter by userId on the client.

    const masterTenantId = environment.taliferroTenantId;
    const allConvos = masterTenantId
      ? await this.dataService.getKnownTenantDocuments( 'ASSISTANT_CONVERSATIONS' as any, masterTenantId )
      : await this.dataService.getCollectionData( 'ASSISTANT_CONVERSATIONS' as any, userId );


    const existing = ( allConvos || [] ).find( ( c: any ) => c.userId === userId ) as AssistantConversation | undefined;

    if ( existing ) {
      this.activeConversation = existing;
      return existing;
    }

    // None found: create one
    const now = Date.now();
    const convo: Omit<AssistantConversation, 'id'> = {
      userId,
      createdAt: now,
      updatedAt: now,
      title: 'TODD Assistant'
    };

    const id = environment.taliferroTenantId
      ? await this.dataService.addKnownTenantDocument(
        'ASSISTANT_CONVERSATIONS' as any,
        convo,
        userId,
        environment.taliferroTenantId
      )
      : await this.dataService.addDocument(
        'ASSISTANT_CONVERSATIONS' as any,
        convo,
        userId
      );

    if ( !id ) throw new Error( 'Failed to create assistant conversation: permission denied' );
    const created: AssistantConversation = { id, ...convo };
    this.activeConversation = created;

    return created;
  }

  /**
   * Load recent messages for the active conversation.
   */
  async loadMessages ( conversationId: string, userId: string, limit: number = 50 ): Promise<AssistantMessage[]> {

    const masterTenantId = environment.taliferroTenantId;
    const all = masterTenantId
      ? await this.dataService.getKnownTenantDocuments( 'ASSISTANT_MESSAGES' as any, masterTenantId )
      : await this.dataService.getCollectionData( 'ASSISTANT_MESSAGES' as any, userId );

    return ( all || [] )
      .filter( ( m: any ) => m.conversationId === conversationId )
      .sort( ( a: any, b: any ) => ( a.ts || 0 ) - ( b.ts || 0 ) )
      .slice( -limit )
      .map( ( m: any ) => ( {
        role: m.role,
        content: m.content,
        ts: m.ts
      } ) ) as AssistantMessage[];
  }

  /**
   * Delete all messages for a conversation.
   * NOTE: This is used by Talk to TODD “Clear history”.
   * It performs a client-side filter because the current DataService helpers pull full collections.
   */
  async clearConversationMessages ( conversationId: string, userId: string ): Promise<void> {
    if ( !conversationId || !userId ) return;

    // Your DataService logs show the storage path is tenants/<USER_ID>/assistantMessages
    // when taliferroTenantId is not set. So we delete against that same tenant id.
    const tenantId = environment.taliferroTenantId || userId;

    // 1) Delete assistantMessages for this conversation (batched)
    try {
      const msgsCol = collection( this.firestore as any, `tenants/${tenantId}/assistantMessages` );
      const q = query( msgsCol as any, where( 'conversationId', '==', conversationId ) );
      const snap = await getDocs( q as any );

      if ( !snap.empty ) {
        const batch = writeBatch( this.firestore as any );
        let opCount = 0;

        snap.forEach( ( d: any ) => {
          batch.delete( doc( msgsCol as any, d.id ) as any );
          opCount++;
        } );

        if ( opCount > 0 ) {
          await batch.commit();
        }
      }
    } catch ( err ) {
      // Fall back to DataService deletes if Firestore batching fails
      try {
        const masterTenantId = environment.taliferroTenantId;
        const all: any[] = masterTenantId
          ? await this.dataService.getKnownTenantDocuments( 'ASSISTANT_MESSAGES' as any, masterTenantId )
          : await this.dataService.getCollectionData( 'ASSISTANT_MESSAGES' as any, userId );

        const targets = ( all || [] ).filter( ( m: any ) => m?.conversationId === conversationId );

        for ( const m of targets ) {
          const id = ( m as any )?.id;
          if ( !id ) continue;

          if ( masterTenantId ) {
            await ( this.dataService as any ).deleteKnownTenantDocument?.(
              'ASSISTANT_MESSAGES' as any,
              id,
              userId,
              masterTenantId
            );
          } else {
            await ( this.dataService as any ).deleteDocument?.(
              'ASSISTANT_MESSAGES' as any,
              id,
              userId
            );
          }
        }
      } catch { /* ignore */ }

      // Keep original error available for debugging
      // eslint-disable-next-line no-console
      this.logger.warn( 'AssistantHistoryService.clearConversationMessages: Firestore delete failed', err );
    }

    // 2) Bump updatedAt on conversation doc (best effort)
    try {
      const now = Date.now();
      if ( this.activeConversation && this.activeConversation.id === conversationId ) {
        this.activeConversation.updatedAt = now;
      }

      const convoRef = doc( this.firestore as any, `tenants/${tenantId}/assistantConversations/${conversationId}` ) as any;
      await updateDoc( convoRef, { updatedAt: now } as any );
    } catch {
      // ignore
    }
  }

  /**
   * Append a new message to Firestore and keep updatedAt fresh on the conversation.
   */
  async appendMessage (
    conversationId: string,
    msg: AssistantMessage,
    userId: string
  ): Promise<void> {
    const payload: any = {
      conversationId,
      role: msg.role,
      content: msg.content,
      ts: msg.ts,

      // Default: INTERNAL. Public sharing must be an explicit action.
      isPublic: msg.isPublic === true,
      visibility: msg.visibility || ( msg.isPublic === true ? 'public' : 'internal' ),
      audience: msg.audience || ( msg.isPublic === true ? 'public' : 'internal' ),

      // Optional display fields
      displayName: ( msg as any ).displayName,
      userName: ( msg as any ).userName
    };

    if ( environment.taliferroTenantId ) {
      await this.dataService.addKnownTenantDocument( 'ASSISTANT_MESSAGES' as any, payload, userId, environment.taliferroTenantId );
    } else {
      await this.dataService.addDocument( 'ASSISTANT_MESSAGES' as any, payload, userId );
    }

    // bump updatedAt on conversation
    if ( this.activeConversation && this.activeConversation.id === conversationId ) {
      this.activeConversation.updatedAt = msg.ts;
    }

    // Fire-and-forget: update document in background
    if ( environment.taliferroTenantId ) {
      this.dataService.updateKnownTenantDocument(
        'ASSISTANT_CONVERSATIONS' as any,
        conversationId,
        { updatedAt: msg.ts },
        userId,
        environment.taliferroTenantId
      ).catch( () => { /* ignore */ } );
    } else {
      this.dataService.updateDocument(
        'ASSISTANT_CONVERSATIONS' as any,
        conversationId,
        { updatedAt: msg.ts },
        userId
      ).catch( () => { /* ignore */ } );
    }
  }

  /**
   * Convenience: returns a trimmed slice of last N messages for LLM context.
   */
  async getRecentHistoryForContext (
    userId: string,
    count: number = 6
  ): Promise<AssistantMessage[]> {
    const convo = await this.getOrCreateActiveConversation( userId );
    const msgs = await this.loadMessages( convo.id, userId, count * 2 ); // load a bit extra
    return msgs.slice( -count );
  }


  /**
 * Homepage social proof feed: returns newest user-question + assistant-answer pairs.
 * Uses KnownTenant when environment.taliferroTenantId is set.
 */
  async getRecentPublicQA ( limitCount: number = 12 ): Promise<Array<{ displayName: string; question: string; answer: string; ts: number; isPublic: boolean; }>> {
    const masterTenantId = environment.taliferroTenantId;

    const all = masterTenantId
      ? await this.dataService.getKnownTenantDocuments( 'ASSISTANT_MESSAGES' as any, masterTenantId )
      : await this.dataService.getCollectionData( 'ASSISTANT_MESSAGES' as any, 'Taliferro' );

    const isPublicMsg = ( m: any ) => m?.isPublic === true || m?.visibility === 'public' || m?.audience === 'public';

    // IMPORTANT: social proof must be explicitly public.
    // If a doc has no public marker, it is treated as INTERNAL.
    const msgs = ( all || [] )
      .filter( ( m: any ) => !!m?.ts )
      .filter( ( m: any ) => isPublicMsg( m ) )
      .sort( ( a: any, b: any ) => ( b.ts || 0 ) - ( a.ts || 0 ) );

    const isUser = ( m: any ) => m?.role === 'user';
    const isAssistant = ( m: any ) => m?.role === 'assistant';

    const pairs: Array<{ displayName: string; question: string; answer: string; ts: number; isPublic: boolean; }> = [];

    for ( let i = 0; i < msgs.length && pairs.length < limitCount; i++ ) {
      const a = msgs[i];
      if ( !isAssistant( a ) ) continue;

      const convoId = a?.conversationId;
      if ( !convoId ) continue;

      // Find nearest previous user message in the same conversation
      const prevUser = msgs.slice( i + 1 ).find( ( x: any ) => isUser( x ) && x?.conversationId === convoId );
      if ( !prevUser ) continue;

      const question = String( prevUser?.content || '' ).trim();
      const answer = String( a?.content || '' ).trim();
      if ( !question || !answer ) continue;

      pairs.push( {
        displayName: String( prevUser?.displayName || prevUser?.userName || 'Someone' ),
        question,
        answer,
        ts: a.ts,
        isPublic: true
      } );
    }

    return pairs;
  }



}
