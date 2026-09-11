import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router, ActivatedRoute } from '@angular/router';
import { LoggerService } from '../../../services/logger.service';
import { ChangeDetectorRef } from '@angular/core';

import { Subscription, filter, combineLatest, take, of, switchMap, Observable, map, catchError } from 'rxjs';
import { UserService } from '../../../services/user.service';
import { Contact } from '../../../shared/data/interfaces/contact.model';
import { SettingsService } from '../../../services/settings.service';

import { AssistantHistoryService, AssistantMessage } from '../../../services/assistant-history.service';
import { TopDogComponent } from '../../../core/top-dog/top-dog.component';
import { AuthService } from '../../../services/auth.service';
import { SoundService } from '../../../services/sound.service';
import { NomenclatureService } from '../../../services/nomenclature.service';
import { OpenAIService } from '../../../services/open-ai.service';
import { AssistantBoxUtilityService } from '../../../services/assistant-box-utility.service';
import { AssistantCapabilitiesService } from '../../../services/assistant-capabilities.service';
import { AssistantComposerFlowService } from '../../../services/assistant-composer-flow.service';
import { ContactService } from '../../../services/contact.service';
import { GoalService, ToddMomentumAction, DailyMomentumApprovalChecklist } from '../../../services/goal.service';
import { AssistantPageContext, ToddAssistantBusService } from '../../../services/todd-assistant-bus.service';
import { DailyCommandInstrumentationLight, DailyCommandPlan, DailyCommandService } from '../../../services/daily-command.service';
import { ToddSystemOutcomeRow } from '../../../shared/page/todd-system-outcomes/todd-system-outcomes.component';
import { TESTIMONIALS, ToddMediaItem, VIDEOS } from './todd-video-library';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToddStatusTone, mapToddStatusTone, shouldPulseToddStatus } from '../../../shared/utils/todd-status-indicator.util';
import { CommandPaletteResult, navigateToEntry, searchEntriesLoose, withIcons } from '../../../shared/page/command-palette/command-palette-match';
import { getFindHomeUrl, getMayaHomeUrl, getNetworkHomeUrl, getPulseHomeUrl, getSayitHomeUrl, getSignatureBuilderUrl, getSocialHomeUrl, getToddHomeUrl, resolveExternalAppUrl } from '../../../shared/utils/public-app-url.util';
import { ToddActivationResolution, ToddActivationStateService } from '../../../services/todd-activation-state.service';


type ToddShowcaseModule = string;

type ToddShowcaseLaunchMode = 'validate-email' | 'campaign-idea' | 'mission-intake' | 'survey-generator' | 'doc-editor';
interface ToddProfileProduct {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  shortDescription?: string;
  audience?: string;
  idealCustomer?: string;
  problemSolved?: string;
  outcome?: string;
  callToAction?: string;
  url?: string;
  tags?: string[];
  image?: { src?: string; alt?: string; };
  smallImage?: { src?: string; alt?: string; };
  active?: boolean;
  promotionPriority?: number;
}

interface ToddShowcasePrompt {
  module: ToddShowcaseModule;
  productId?: string;
  headline: string;
  body: string;
  ctaLabel: string;
  route: string;
  launchMode: ToddShowcaseLaunchMode;
  rewardText?: string;
}

interface ToddPublicProduct {
  name: string;
  badge?: string;
  description: string;
  callToAction: string;
  route?: string;
  prompt?: string;
  image?: string;
}

interface ToddAssistantPresentation {
  suppressSuggestedProduct?: boolean;
  suppressSuggestedMedia?: boolean;
  responseMode?: string | null;
}

interface ToddFindHandoff {
  product: 'find';
  query: string;
}

@Component( {
  selector: 'app-todd',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './todd.component.html',
  styleUrl: './todd.component.css'
} )

export class ToddComponent extends TopDogComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild( 'history' ) historyRef!: ElementRef<HTMLDivElement>;
  @ViewChild( 'assistantInput' ) assistantInputRef?: ElementRef<HTMLInputElement | HTMLTextAreaElement>;

  playedVideoIds: Set<string> = new Set<string>();
  suggestedVideo: ToddMediaItem | null = null;
  suggestedVideoReason: string = '';
  activeVideo: ToddMediaItem | null = null;
  activeVideoEmbedUrl: SafeResourceUrl | '' = '';


  suggestedProductAction: {
    label: string;
    description: string;
    route: string;
    image: string;
  } | null = null;

  proactiveMomentumAction: ToddMomentumAction | null = null;
  proactiveMomentumChecklist: DailyMomentumApprovalChecklist | null = null;
  proactiveShowcasePrompt: ToddShowcasePrompt | null = null;
  private readonly showcaseStoragePrefix = 'todd:showcase-prompt';


  firstName!: string;

  getLoggedInContactInfoSubscription!: Subscription;
  loggedInContact!: Contact;





  messages: Array<{ role: 'user' | 'assistant'; content: string; }> = [];

  assistantPrompt: string = '';
  routeSuggestions: CommandPaletteResult[] = [];
  private askSubscription?: Subscription;
  private findHandoffTimer?: ReturnType<typeof setTimeout>;
  private pageContextSubscription?: Subscription;
  private assistantPageContext: AssistantPageContext | null = null;
  private queryPromptHandled = false;
  private systemOutcomesIdentitySubscription?: Subscription;
  private systemOutcomesPlanSubscription?: Subscription;

  private assistantConversationId: string | null = null;
  private historyInitialized: boolean = false;
  private loggedInContactResolved: boolean = false;
  systemOutcomeRows: ToddSystemOutcomeRow[] = [];
  systemOutcomesLoading = false;
  systemStatusLights: DailyCommandInstrumentationLight[] = [];
  embeddedAppPath: string | null = null;
  embeddedAppUrl: SafeResourceUrl | '' = '';
  embeddedAppLabel = '';
  // Every entry here used to be a same-origin route inside the monolith.
  // This app only has '/' of its own, so everything else routes out to
  // wherever that module actually lives now: Network/Pulse at their own
  // extracted homes, everything else still at todd.taliferro.tech.
  readonly toddHomeUrl = getToddHomeUrl();
  private proactiveMomentumStateSubscription?: Subscription;
  private proactiveMomentumInFlight: boolean = false;
  private readonly proactiveMomentumStoragePrefix = 'todd:daily-momentum-briefing';
  private readonly platformId = inject( PLATFORM_ID );
  private readonly isBrowser = isPlatformBrowser( this.platformId );
  public profileProducts: ToddProfileProduct[] = [];
  askToddTourInputLocked = false;
  public readonly publicProducts: ToddPublicProduct[] = [
    {
      name: 'Taliferro Group',
      badge: 'Emergency service',
      description: 'The $999 rescue helps diagnose a broken website, workflow, API, data issue, or software bottleneck and gives you a clear repair plan.',
      callToAction: 'Ask about rescue',
      route: 'https://calendar.app.google/FqCEPEFsuLgPDrsr6'
    }
  ];

  constructor (
    protected override authService: AuthService,
    protected override settingsService: SettingsService,
    protected override soundService: SoundService,
    protected override logger: LoggerService,
    protected override router: Router,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    protected override nomenclatureService: NomenclatureService,
    private openAIService: OpenAIService,
    private goalService: GoalService,
    private assistantHistoryService: AssistantHistoryService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private assistantBoxUtilityService: AssistantBoxUtilityService,
    private assistantCapabilities: AssistantCapabilitiesService,
    private assistantComposerFlow: AssistantComposerFlowService,
    private contactService: ContactService,
    private dailyCommandService: DailyCommandService,
    private assistantBus: ToddAssistantBusService,
    private toddActivationStateService: ToddActivationStateService ) {
    super( authService, settingsService, soundService, logger, router, nomenclatureService );
  }

  override ngOnInit (): void {
    super.ngOnInit();
    this.pageContextSubscription = this.assistantBus.pageContext$.subscribe( ctx => {
      this.assistantPageContext = this.shouldUseProspectPageContext( ctx ) ? ctx : null;
    } );
    this.processLoggedInContact();
    this.watchSystemOutcomes();
    this.watchMomentumBriefingReadiness();
    this.handleQueryPrompt();
  }

  override ngOnDestroy (): void {
    super.ngOnDestroy();
    this.getLoggedInContactInfoSubscription?.unsubscribe();
    this.askSubscription?.unsubscribe();
    this.systemOutcomesIdentitySubscription?.unsubscribe();
    this.systemOutcomesPlanSubscription?.unsubscribe();
    this.proactiveMomentumStateSubscription?.unsubscribe();
    this.pageContextSubscription?.unsubscribe();
    if ( this.findHandoffTimer ) clearTimeout( this.findHandoffTimer );
  }


  override ngAfterViewInit (): void {
    super.ngAfterViewInit();
    // Ensure we start scrolled to bottom if there are seeded messages
    this.zone.runOutsideAngular( () => {
      requestAnimationFrame( () => this.scrollHistoryToBottom( true ) );
    } );
  }

  private getActiveProfileProductsInternal (): ToddProfileProduct[] {
    const products = ( this.loggedInContact as any )?.company?.products;
    if ( !Array.isArray( products ) ) return [];

    return products
      .filter( p => p && p.discontinued !== true && p.active !== false )
      .sort( ( a, b ) => Number( a?.promotionPriority || 999 ) - Number( b?.promotionPriority || 999 ) );
  }

  getMomentumActionStatusTone ( state: string | null | undefined ): ToddStatusTone {
    if ( state === 'queued' ) {
      return 'active';
    }

    return mapToddStatusTone( state );
  }

  shouldPulseMomentumActionStatus ( state: string | null | undefined ): boolean {
    if ( state === 'queued' ) {
      return true;
    }

    return shouldPulseToddStatus( state );
  }

  getMomentumActionStatusLabel ( state: string | null | undefined ): string {
    if ( state === 'confirm' ) return 'Waiting for confirmation';
    if ( state === 'queued' ) return 'Queued by TODD';
    if ( state === 'drafted' ) return 'Draft ready to apply';
    if ( state === 'selected' ) return 'Selected by TODD';
    return 'Status available';
  }

  toddAnswer () {
    this.soundService.playSound( "finished" );
  }

  private watchSystemOutcomes (): void {
    this.systemOutcomesIdentitySubscription?.unsubscribe();
    this.systemOutcomesIdentitySubscription = combineLatest( [
      this.authService.isLoggedIn(),
      this.authService.getTenantId(),
      this.authService.getUserId()
    ] )
      .pipe(
        map( ( [isLoggedIn, tenantId, userId] ) => ( {
          isLoggedIn: !!isLoggedIn,
          tenantId: String( tenantId || '' ).trim(),
          userId: String( userId || '' ).trim()
        } ) )
      )
      .subscribe( identity => {
        if ( !identity.isLoggedIn || !identity.tenantId || !identity.userId || identity.userId === 'Taliferro' ) {
          this.systemOutcomesPlanSubscription?.unsubscribe();
          this.systemOutcomeRows = [];
          this.systemOutcomesLoading = false;
          return;
        }

        this.loadSystemOutcomes( identity.tenantId, identity.userId );
      } );
  }

  private loadSystemOutcomes ( tenantId: string, userId: string ): void {
    this.systemOutcomesPlanSubscription?.unsubscribe();
    this.systemOutcomesLoading = true;
    this.systemOutcomesPlanSubscription = this.dailyCommandService.getDailyCommandPlan( tenantId, userId )
      .pipe( take( 1 ) )
      .subscribe( {
        next: plan => {
          this.systemOutcomeRows = this.buildSystemOutcomeRows( plan );
          this.systemStatusLights = plan?.instrumentation?.lights || [];
          this.systemOutcomesLoading = false;
        },
        error: err => {
          this.logger.warn( 'TODD system outcomes rail failed to load', err );
          this.systemOutcomeRows = [];
          this.systemStatusLights = [];
          this.systemOutcomesLoading = false;
        }
      } );
  }

  private buildSystemOutcomeRows ( plan: DailyCommandPlan | null | undefined ): ToddSystemOutcomeRow[] {
    if ( !plan ) return [];

    return plan.moduleReadiness.map( module => {
      return {
        id: `module-action-${module.key}`,
        moduleLabel: module.label,
        stateLabel: module.stateLabel,
        summary: this.systemOutcomeSummaryForModule( module ),
        detail: this.systemOutcomeDetailForModule( module ),
        tone: module.indicatorTone,
        toneClass: this.toSystemOutcomeToneClass( module.indicatorTone ),
        actionLabel: null,
        route: null
      };
    } );
  }

  private systemOutcomeSummaryForModule ( module: DailyCommandPlan['moduleReadiness'][number] ): string {
    switch ( module.key ) {
      case 'network':
        return module.state === 'ready'
          ? 'Relationships are ready for TODD right now'
          : 'Relationships still need stronger contact coverage';
      case 'outreach':
        return module.state === 'ready'
          ? 'Growth is ready for TODD right now'
          : module.state === 'attention'
            ? 'Growth is live, but outbound work still needs review'
            : 'Growth is blocked until sender setup is complete';
      case 'social':
        return module.state === 'ready'
          ? 'Visibility is ready for TODD right now'
          : module.state === 'attention'
            ? 'Visibility is live, but social review is still needed'
            : 'Visibility is blocked until a social account is connected';
      case 'moves':
        return module.state === 'ready'
          ? 'Execution is ready for TODD right now'
          : 'Execution still has overdue work to clean up';
      case 'docs':
        return module.state === 'ready'
          ? 'Knowledge is ready for TODD right now'
          : module.state === 'attention'
            ? 'Knowledge is live, but document context still needs review'
            : 'Knowledge is blocked until core business context is complete';
      case 'pulse':
        return module.state === 'ready'
          ? 'Feedback is ready for TODD right now'
          : module.state === 'attention'
            ? 'Feedback is live, but signal review is still needed'
            : 'Feedback is blocked until revenue setup is complete';
      default:
        return module.state === 'ready'
          ? `${module.label} is ready for TODD right now`
          : module.state === 'attention'
            ? `${module.label} still needs attention`
            : `${module.label} is blocked until setup is completed`;
    }
  }

  private systemOutcomeDetailForModule ( module: DailyCommandPlan['moduleReadiness'][number] ): string {
    return module.proof || module.detail;
  }

  private toSystemOutcomeToneClass ( tone: ToddSystemOutcomeRow['tone'] ): string {
    return `today-cockpit__tone--${tone}`;
  }

  onQuickPill ( question: string ) {
    if ( this.handleActiveTourInputInterruption() ) {
      return;
    }
    this.assistantPrompt = question;
    this.askAssistant();
  }

  // There's no multi-conversation history to browse yet — AssistantHistoryService
  // keeps exactly one ongoing conversation per user, already auto-loaded on
  // sign-in. This just surfaces that state honestly instead of pretending to
  // open a saved-conversations list that doesn't exist. Revisit once there's
  // a real "list past conversations" capability to link to.
  openSaved (): void {
    if ( this.isLoggedIn ) {
      this.onMessage( {
        role: 'assistant',
        content: this.assistantBoxUtilityService.normalizeModelOutputToHtml(
          'This conversation is saved automatically while you are signed in — it will be here next time you come back.'
        )
      } );
      return;
    }

    this.onMessage( {
      role: 'assistant',
      content: this.assistantBoxUtilityService.normalizeModelOutputToHtml(
        'Sign in to save this conversation and pick up where you left off next time.'
      )
    } );
  }

  private handleQueryPrompt (): void {
    if ( !this.isBrowser || this.queryPromptHandled ) return;

    const prompt = String( this.route.snapshot.queryParamMap.get( 'q' ) || '' ).trim();
    if ( !prompt ) return;

    this.queryPromptHandled = true;

    this.zone.runOutsideAngular( () => {
      requestAnimationFrame( () => {
        this.zone.run( () => {
          this.assistantPrompt = prompt;
          this.askAssistant();

          void this.router.navigate( [], {
            relativeTo: this.route,
            queryParams: { q: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
          } );
        } );
      } );
    } );
  }

  async askAssistant (): Promise<void> {
    this.suggestedProductAction = null;
    const prompt = ( this.assistantPrompt || '' ).trim();
    if ( !prompt ) return;

    if ( this.handleActiveTourInputInterruption() ) {
      return;
    }

    if ( this.askSubscription ) {
      this.askSubscription.unsubscribe();
    }

    this.onMessage( { role: 'user', content: prompt } );
    this.assistantPrompt = '';
    this.routeSuggestions = [];
    this.isLoading = true;

    if ( await this.tryHandleToddHomeShortcut( prompt ) ) {
      this.isLoading = false;
      this.focusAssistantInput();
      return;
    }

    if ( this.tryOpenEmbeddedApp( prompt ) ) {
      this.isLoading = false;
      this.focusAssistantInput();
      return;
    }

    const questionAndAnswerHistory = this.buildProspectHistory();

    this.askSubscription = this.resolveProspectPageContext( prompt )
      .pipe(
        take( 1 ),
        switchMap( pageContext => this.openAIService.getProspectQuery(
          {
            history: questionAndAnswerHistory,
            pageContext,
            profileContext: this.buildProspectProfileContext()
          },
          this.userId
        ) )
      )
      .subscribe( {
        next: ( reply: any ) => {
          this.logger.info( 'TODD raw reply', reply );
          this.logger.info( 'TODD raw reply preview', reply?.preview );
          this.logger.info( 'TODD raw reply response', reply?.response );
          const assistantText = this.extractAssistantHtml( reply );
          const presentation = this.extractAssistantPresentation( reply );
          const route = this.extractAssistantRoute( reply );
          const findHandoff = this.extractFindHandoff( reply, prompt );
          const category = this.resolveSuggestedProductCategory( prompt, assistantText );
          this.logger.info( 'TODD normalized assistant html', assistantText );
          this.onMessage( {
            role: 'assistant',
            content: findHandoff
              ? '<p>This is a question more for <strong>Find</strong>. I’ll open it for you in a moment.</p>'
              : assistantText || 'I did not get a usable answer back. Please try again.'
          } );

          if ( findHandoff ) {
            this.scheduleFindHandoff( findHandoff.query );
          }
          const suppressSuggestedProduct = presentation?.suppressSuggestedProduct === true;
          const suppressSuggestedMedia = presentation?.suppressSuggestedMedia === true;

          this.suggestedProductAction = suppressSuggestedProduct
            ? null
            : this.buildSuggestedProductAction( category, prompt, assistantText );

          const mediaSuggestion = suppressSuggestedMedia
            ? { item: null, reason: '' }
            : this.pickMediaForPrompt( prompt, assistantText );

          this.logger.info( 'TODD picked media', mediaSuggestion );
          if ( mediaSuggestion?.item ) {
            this.suggestedVideo = mediaSuggestion.item;
            this.suggestedVideoReason = mediaSuggestion.reason;
            this.trackToddMediaEvent( 'todd_media_suggested', mediaSuggestion.item, {
              prompt,
              reason: mediaSuggestion.reason,
              isLoggedIn: this.isLoggedIn
            } );
          } else {
            this.suggestedVideo = null;
            this.suggestedVideoReason = '';
          }

          if ( route ) {
            this.suggestedProductAction = this.buildRouteSuggestedProductAction( route, assistantText )
              || this.suggestedProductAction;
          }

          if ( route && this.shouldAutoNavigatePrompt( prompt ) ) {
            this.soundService.playSound( 'click' );
            this.goExternal( route );
          }

          this.isLoading = false;
          this.focusAssistantInput();
          this.toddAnswer();
        },
        error: ( err: any ) => {
          this.logger.error( 'TODD askAssistant failed', err );
          this.suggestedProductAction = {
            label: 'Open Help',
            description: 'Open Help for guidance on TODD, its products, and the next step for your situation.',
            route: `${this.toddHomeUrl}/help`,
            image: 'assets/TODD-icon.png'
          };
          this.onMessage( {
            role: 'assistant',
            content: this.formatAssistantError( err )
          } );
          this.isLoading = false;
          this.focusAssistantInput();
        }
      } );
  }

  resetConversation (): void {
    this.handleActiveTourInputInterruption();
    void this.onAssistantResetRequested();
    this.assistantPrompt = '';
    this.suggestedVideo = null;
    this.suggestedVideoReason = '';
    this.activeVideo = null;
    this.activeVideoEmbedUrl = '';
    this.suggestedProductAction = null;
    this.proactiveMomentumAction = null;
    this.proactiveMomentumChecklist = null;
    this.proactiveShowcasePrompt = null;
    this.embeddedAppPath = null;
    this.embeddedAppUrl = '';
    this.embeddedAppLabel = '';
    this.focusAssistantInput();
  }

  exportTranscript (): void {
    if ( !this.messages.length || !this.isBrowser ) return;

    const stamp = new Date();
    const lines = this.messages.map( message => {
      const speaker = message.role === 'user' ? 'You' : 'TODD';
      const content = this.stripHtmlForPrompt( String( message.content || '' ) );
      return `${speaker}:\n${content}`;
    } );
    const transcript = `TODD conversation transcript — ${stamp.toLocaleString()}\n\n${lines.join( '\n\n' )}\n`;

    const blob = new Blob( [transcript], { type: 'text/plain;charset=utf-8' } );
    const url = URL.createObjectURL( blob );
    const anchor = document.createElement( 'a' );
    anchor.href = url;
    anchor.download = `todd-transcript-${stamp.toISOString().slice( 0, 10 )}.txt`;
    anchor.click();
    URL.revokeObjectURL( url );
  }

  /**
   * The monolith's ToddComponent navigates internally (`router.navigate`)
   * for every suggested action, showcase prompt, and momentum CTA. None of
   * those routes exist in this standalone app, so every one of them has to
   * leave the app instead — see resolveExternalAppUrl for where each target
   * actually lands (Network/Pulse externally, everything else back at
   * todd.taliferro.tech).
   */
  private goExternal ( path: string, queryParams?: Record<string, string>, newTab = false ): void {
    if ( !this.isBrowser ) return;

    let url = resolveExternalAppUrl( path );
    if ( queryParams && Object.keys( queryParams ).length ) {
      const parsed = new URL( url );
      for ( const [key, value] of Object.entries( queryParams ) ) {
        parsed.searchParams.set( key, value );
      }
      url = parsed.toString();
    }

    if ( newTab ) window.open( url, '_blank', 'noopener' );
    else window.location.href = url;
  }

  override onClickRoute ( goto: string ): void {
    const [path] = String( goto || '' ).split( '#' );
    this.goExternal( path );
  }

  closeEmbeddedNetwork (): void {
    this.embeddedAppPath = null;
    this.embeddedAppUrl = '';
    this.embeddedAppLabel = '';
    this.focusAssistantInput();
  }

  scrollToEmbeddedApp (): void {
    if ( !this.isBrowser ) return;
    requestAnimationFrame( () => {
      const embeddedApp = document.querySelector<HTMLElement>( '.todd-embedded-app' );
      embeddedApp?.scrollIntoView( { behavior: 'smooth', block: 'end' } );
    } );
  }

  private tryOpenEmbeddedApp ( prompt: string ): boolean {
    // Embedded views are authenticated workspace surfaces. Guests should get
    // the product explanation and value path instead of an empty/private app.
    if ( !this.isLoggedIn ) return false;

    const normalized = String( prompt || '' ).trim().toLowerCase();
    if ( /\b(list|show|find|search)\b.*\b(contacts?|companies)\b/.test( normalized ) ) {
      const path = `${this.toddHomeUrl}/contact-list?embedded=true&q=${encodeURIComponent( normalized )}`;
      this.embeddedAppPath = path;
      this.embeddedAppUrl = this.sanitizer.bypassSecurityTrustResourceUrl( path );
      this.embeddedAppLabel = 'Contact list';
      this.onMessage( {
        role: 'assistant',
        content: 'Here is the matching contact list. The embedded view keeps the useful records available without leaving TODD.'
      } );
      return true;
    }
    // Network/Pulse were later extracted to their own domains and already
    // support ?embedded=true there; everything else here is still only
    // reachable inside the todd.taliferro.tech monolith.
    const listApps = [
      { match: /\b(list|show|find|search)\b.*\b(docs?|documents?|files?)\b/, path: `${this.toddHomeUrl}/documents?embedded=true`, label: 'Document list' },
      { match: /\b(list|show|find|search)\b.*\b(repository|knowledge base)\b/, path: `${this.toddHomeUrl}/knowledge-base?embedded=true`, label: 'Repository' },
      { match: /\b(list|show|find|search)\b.*\b(surveys?|pulses?)\b/, path: `${this.toddHomeUrl}/survey-list?embedded=true`, label: 'Survey list' },
      { match: /\b(list|show|find|search)\b.*\bmoves?\b/, path: `${this.toddHomeUrl}/moves-view?embedded=true&view=hierarchy`, label: 'Moves list' }
    ];
    const listApp = listApps.find( candidate => candidate.match.test( normalized ) );
    if ( listApp ) {
      this.embeddedAppPath = listApp.path;
      this.embeddedAppUrl = this.sanitizer.bypassSecurityTrustResourceUrl( listApp.path );
      this.embeddedAppLabel = listApp.label;
      this.onMessage( { role: 'assistant', content: `Here is the ${listApp.label}. The embedded view keeps the records available without leaving TODD.` } );
      return true;
    }
    const asksForStatus = /\b(status|health|dashboard|overview|summary|signals?|attention|needs attention)\b/.test( normalized );
    const apps = [
      { match: /\b(network|relationships?)\b/, path: `${getNetworkHomeUrl()}/app?embedded=true`, label: 'Network status' },
      { match: /\b(moves?|tasks?|execution)\b/, path: `${this.toddHomeUrl}/moves/app?embedded=true`, label: 'Moves status' },
      { match: /\b(pulse|survey|surveys|feedback)\b/, path: `${getPulseHomeUrl()}/app?embedded=true`, label: 'Pulse status' },
      { match: /\b(docs?|documents?|knowledge)\b/, path: `${this.toddHomeUrl}/docs/app?embedded=true`, label: 'Docs status' },
      { match: /\b(outreach|growth|follow[- ]?up)\b/, path: `${this.toddHomeUrl}/outreach/app?embedded=true`, label: 'Outreach status' }
    ];
    const app = apps.find( candidate => candidate.match.test( normalized ) && ( asksForStatus || /\b(show|open|review|check|what)\b/.test( normalized ) ) );
    if ( !app ) return false;

    this.embeddedAppPath = app.path;
    this.embeddedAppUrl = this.sanitizer.bypassSecurityTrustResourceUrl( app.path );
    this.embeddedAppLabel = app.label;
    this.onMessage( {
      role: 'assistant',
      content: `Here is the current ${app.label}. The embedded view keeps the useful status content available without leaving TODD.`
    } );
    return true;
  }

  onAssistantPromptChange (): void {
    this.handleActiveTourInputInterruption();
    this.routeSuggestions = withIcons( searchEntriesLoose( this.assistantPrompt ) );
  }

  selectRouteSuggestion ( entry: CommandPaletteResult ): void {
    this.routeSuggestions = [];
    this.assistantPrompt = '';
    navigateToEntry( this.router, entry );
  }

  dismissRouteSuggestions (): void {
    this.routeSuggestions = [];
  }

  onAssistantInputFocus (): void {
    this.handleActiveTourInputInterruption();
  }

  private handleActiveTourInputInterruption (): boolean {
    return false;
  }

  private resolveSuggestedProductCategory ( prompt: string, assistantText: string ): string | null {
    const profileProduct = this.findBestProfileProductMatch( prompt, assistantText );
    if ( profileProduct ) return this.getProductKey( profileProduct );

    return this.inferMediaCategory( `${prompt} ${this.stripHtmlForPrompt( assistantText )}` );
  }


  public getProductDisplayName ( product: ToddProfileProduct | null | undefined ): string {
    return String( product?.name || product?.title || 'Product' ).trim() || 'Product';
  }

  private getProductKey ( product: ToddProfileProduct | null | undefined ): string {
    const raw = String( product?.name || product?.id || product?.title || '' ).trim().toLowerCase();
    return raw.replace( /[^a-z0-9]+/g, '_' ).replace( /^_+|_+$/g, '' ) || 'product';
  }

  private getProductRoute ( product: ToddProfileProduct | null | undefined ): string {
    const rawUrl = String( product?.url || '' ).trim();
    if ( !rawUrl ) return '';

    try {
      const parsed = new URL( rawUrl );
      return `${parsed.pathname}${parsed.search || ''}${parsed.hash || ''}` || rawUrl;
    } catch {
      return rawUrl;
    }
  }

  /**
   * Product recommendation cards introduce a product to visitors, so their
   * primary action belongs on the product landing page. Explicit assistant
   * routes still use `/app` when the user asked to open the working area.
   */
  private getProductLandingRoute ( route: string ): string {
    const normalized = String( route || '' ).trim();
    const landingRoutes: Record<string, string> = {
      '/network/app': getNetworkHomeUrl(),
      '/pulse/app': getPulseHomeUrl(),
      '/outreach/app': 'https://outreach.taliferro.tech',
      '/moves/app': 'https://moves.taliferro.tech',
      '/docs/app': 'https://docs.taliferro.tech'
    };

    return landingRoutes[normalized] || normalized;
  }

  public getProductImage ( product: ToddProfileProduct | null | undefined ): string {
    return String(
      product?.image?.src ||
      product?.smallImage?.src ||
      'assets/images/no-image.svg'
    ).trim();
  }

  public getProductDescription ( product: ToddProfileProduct | null | undefined ): string {
    return String(
      product?.shortDescription ||
      product?.problemSolved ||
      product?.description ||
      product?.outcome ||
      ''
    ).trim();
  }

  private normalizeProductSearchText ( value: string ): string {
    return String( value || '' )
      .toLowerCase()
      .replace( /<[^>]+>/g, ' ' )
      .replace( /[^a-z0-9]+/g, ' ' )
      .replace( /\s+/g, ' ' )
      .trim();
  }

  public onProductCardClick ( product: ToddProfileProduct ): void {
    this.soundService.playSound( 'click' );

    const route = this.getProductRoute( product );

    if ( route ) {
      this.goExternal( route );
      return;
    }

    const prompt =
      product?.callToAction ||
      `Tell me about ${this.getProductDisplayName( product )}`;

    this.onQuickPill( prompt );
  }

  public onPublicProductClick ( product: ToddPublicProduct ): void {
    if ( product.route ) {
      this.goExternal( product.route );
      return;
    }

    this.onQuickPill( product.prompt || `Tell me about ${product.name}` );
  }

  private getProductSearchText ( product: ToddProfileProduct ): string {
    return this.normalizeProductSearchText( [
      product?.name,
      product?.title,
      product?.description,
      product?.shortDescription,
      product?.audience,
      product?.idealCustomer,
      product?.problemSolved,
      product?.outcome,
      product?.callToAction,
      Array.isArray( product?.tags ) ? product.tags.join( ' ' ) : ''
    ].filter( Boolean ).join( ' ' ) );
  }

  private findBestProfileProductMatch ( prompt: string, assistantText: string = '' ): ToddProfileProduct | null {
    const products = this.profileProducts;
    if ( !products.length ) return null;

    const combined = this.normalizeProductSearchText( `${prompt} ${this.stripHtmlForPrompt( assistantText )}` );
    if ( !combined ) return products[0];

    const terms = combined.split( ' ' ).filter( term => term.length > 2 );

    const ranked = products
      .map( product => ( {
        product,
        score: this.scoreProfileProductMatch( product, combined, terms )
      } ) )
      .filter( entry => entry.score > 0 )
      .sort( ( a, b ) => b.score - a.score );

    return ranked[0]?.product || null;
  }

  private scoreProfileProductMatch ( product: ToddProfileProduct, combinedText: string, terms: string[] ): number {
    let score = 0;
    const name = this.normalizeProductSearchText( product?.name || '' );
    const title = this.normalizeProductSearchText( product?.title || '' );
    const tags = Array.isArray( product?.tags ) ? product.tags.map( tag => this.normalizeProductSearchText( tag ) ) : [];
    const productText = this.getProductSearchText( product );

    if ( name && combinedText.includes( name ) ) score += 100;
    if ( title && combinedText.includes( title ) ) score += 60;

    for ( const tag of tags ) {
      if ( tag && combinedText.includes( tag ) ) score += 35;
    }

    for ( const term of terms ) {
      if ( name.split( ' ' ).includes( term ) ) score += 20;
      else if ( tags.some( tag => tag.split( ' ' ).includes( term ) ) ) score += 12;
      else if ( productText.includes( term ) ) score += 3;
    }

    const priority = Number( product?.promotionPriority );
    if ( Number.isFinite( priority ) ) score += Math.max( 0, 12 - priority );

    return score;
  }



  private formatAssistantError ( err: any ): string {
    return [
      '<p>I could not finish that answer right now.</p>',
      '<p>But you are not stuck. Open <strong>Help</strong> for guidance on TODD, its products, and the next step for your situation.</p>'
    ].join( '' );
  }

  private extractAssistantHtml ( reply: any ): string {
    if ( !reply ) return '';

    const normalizedReply = this.unwrapReplyPayload( reply );
    return this.assistantBoxUtilityService.normalizeModelOutputToHtml( normalizedReply );
  }

  private extractAssistantPresentation ( reply: any ): ToddAssistantPresentation | null {
    const presentation = reply?.response?.presentation;
    if ( !presentation || typeof presentation !== 'object' ) {
      return null;
    }

    return {
      suppressSuggestedProduct: presentation.suppressSuggestedProduct === true,
      suppressSuggestedMedia: presentation.suppressSuggestedMedia === true,
      responseMode: typeof presentation.responseMode === 'string'
        ? presentation.responseMode
        : null
    };
  }

  private extractFindHandoff ( reply: any, fallbackQuery: string ): ToddFindHandoff | null {
    const handoff = reply?.response?.handoff;
    if ( handoff?.product !== 'find' || !String( handoff.query || '' ).trim() ) return null;

    return {
      product: 'find',
      query: String( handoff.query || fallbackQuery ).trim()
    };
  }

  private scheduleFindHandoff ( query: string ): void {
    if ( !this.isBrowser || !query.trim() ) return;

    const findUrl = new URL( getFindHomeUrl() );
    findUrl.searchParams.set( 'q', query.trim() );
    this.findHandoffTimer = setTimeout( () => {
      window.open( findUrl.toString(), '_blank', 'noopener' );
    }, 5000 );
  }

  private extractAssistantRoute ( reply: any ): string | null {
    const directRoute = reply?.response?.route;
    if ( typeof directRoute === 'string' && directRoute.trim() ) {
      return directRoute.trim();
    }

    const preview = reply?.preview;
    if ( typeof preview === 'string' && preview.trim() ) {
      try {
        const parsed = JSON.parse( preview );
        const previewRoute = parsed?.route || parsed?.response?.route;
        return typeof previewRoute === 'string' && previewRoute.trim() ? previewRoute.trim() : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  private unwrapReplyPayload ( reply: any ): any {
    if ( !reply ) return '';
    this.logger.info( 'TODD unwrapReplyPayload input', reply );

    if ( typeof reply === 'string' ) {
      return reply.trim();
    }

    const directResponse = reply?.response;
    if ( typeof directResponse === 'string' && directResponse.trim() ) {
      return directResponse.trim();
    }

    const nestedDirectResponse = reply?.response?.response;
    if ( typeof nestedDirectResponse === 'string' && nestedDirectResponse.trim() ) {
      return nestedDirectResponse.trim();
    }

    const preview = reply?.preview;
    if ( typeof preview === 'string' && preview.trim() ) {
      try {
        const parsed = JSON.parse( preview );
        this.logger.info( 'TODD parsed preview payload', parsed );
        const nestedResponse = parsed?.response;
        if ( typeof nestedResponse === 'string' && nestedResponse.trim() ) {
          return nestedResponse.trim();
        }

        const nestedObjectResponse = parsed?.response?.response;
        if ( typeof nestedObjectResponse === 'string' && nestedObjectResponse.trim() ) {
          return nestedObjectResponse.trim();
        }

        return parsed;
      } catch {
        return preview.trim();
      }
    }

    const outputText = reply?.output_text;
    if ( typeof outputText === 'string' && outputText.trim() ) {
      return outputText.trim();
    }

    return reply;
  }

  private shouldAutoNavigatePrompt ( prompt: string ): boolean {
    return /\b(take me|go to|open|navigate|bring me|send me)\b/i.test( String( prompt || '' ) );
  }

  private buildRouteSuggestedProductAction ( route: string, assistantText: string ): { label: string; description: string; route: string; image: string; } | null {
    const normalized = String( route || '' ).trim();
    if ( !normalized ) return null;

    const routeLabels: Record<string, { label: string; image: string; }> = {
      '/compose-email': { label: 'Open Email Composer', image: 'assets/images/todd-overview.webp' },
      '/outreach/app': { label: 'Open Outreach', image: 'assets/images/todd-overview.webp' },
      '/outbox': { label: 'Open Signal Engine', image: 'assets/images/todd-overview.webp' },
      '/network/app': { label: 'Open Network', image: 'assets/network/network.png' },
      '/moves/app': { label: 'Open Moves', image: 'assets/images/todd-overview.webp' },
      '/daily-momentum': { label: 'Open Daily Momentum', image: 'assets/images/todd-overview.webp' },
      '/docs/app': { label: 'Open Docs', image: 'assets/images/todd-overview.webp' },
      '/pulse/app': { label: 'Open Pulse', image: 'assets/images/todd-overview.webp' },
    };

    const match = routeLabels[normalized];
    if ( !match ) return null;

    return {
      label: match.label,
      description: this.stripHtmlForPrompt( assistantText ) || `TODD found the right place for this request: ${normalized}.`,
      route: normalized,
      image: match.image
    };
  }

  private async tryHandleToddHomeShortcut ( prompt: string ): Promise<boolean> {
    if ( this.shouldRedirectMarketingPromptToMaya( prompt ) ) {
      this.soundService.playSound( 'click' );
      if ( typeof window !== 'undefined' ) window.open( getMayaHomeUrl(), '_blank', 'noopener' );
      return true;
    }

    if ( /^(find\s+a\s+contact|find\s+contact)$/i.test( String( prompt || '' ).trim() ) ) {
      this.suggestedProductAction = {
        label: 'Open Network',
        description: 'Search contacts, leads, and relationship data in one place. Use Lead Vault when you need net-new leads outside your network.',
        route: '/network/app',
        image: 'assets/network/network.png'
      };
      this.onMessage( {
        role: 'assistant',
        content: this.assistantBoxUtilityService.normalizeModelOutputToHtml(
          'To find a contact, open Network. That is where your contact records, leads, and relationship data live. If you need a net-new lead outside your existing network, use Lead Vault.'
        )
      } );
      return true;
    }

    const normalizedPrompt = String( prompt || '' ).trim().toLowerCase().replace( /[?!.]+$/, '' );

    if ( /^(how\s+do\s+i\s+)?get\s+started(?:\s+with\s+todd)?$/.test( normalizedPrompt )
      || /^how\s+do\s+i\s+get\s+started(?:\s+with\s+todd)?$/.test( normalizedPrompt ) ) {
      await this.answerGettingStarted();
      return true;
    }

    const introAnswers: Record<string, string> = {
      'what is todd': '<p>TODD is a <strong>Momentum System</strong>. It turns scattered information across relationships, growth, knowledge, execution, feedback, signals, and visibility into clear next moves.</p><p>A CRM stores history. TODD helps answer one practical question: <strong>Given what I know right now, what should I do next?</strong></p><img class="todd-statement-image" src="assets/todd-solution-statement.png" alt="TODD turns scattered information into the next action">',
      'how can todd help me': '<p>TODD helps you make progress across the parts of work that are easy to separate and difficult to manage alone.</p><p>It connects contacts, emails, documents, feedback, tasks, and signals so you can see what matters, understand where work is slowing down, and act before an opportunity becomes a loss.</p><img class="todd-statement-image" src="assets/todd-problem-statement.png" alt="The cost of losing the thread">',
      'what is a momentum system': '<p>A Momentum System turns information into movement.</p><p>It watches what is happening across your work, surfaces the signal that matters, and helps you choose the next action before momentum disappears. TODD is built around that idea: <strong>when your work moves forward, you become a more capable version of yourself.</strong></p>'
    };

    if ( introAnswers[normalizedPrompt] ) {
      this.suggestedProductAction = null;
      this.suggestedVideo = null;
      this.suggestedVideoReason = '';
      this.onMessage( { role: 'assistant', content: introAnswers[normalizedPrompt] } );
      return true;
    }

    const directNav = this.assistantCapabilities.tryDirectNavCommand( prompt );
    if ( directNav.handled ) {
      if ( directNav.kind === 'message' ) {
        this.onMessage( {
          role: 'assistant',
          content: this.assistantBoxUtilityService.normalizeModelOutputToHtml( directNav.message )
        } );
        return true;
      }

      if ( directNav.kind === 'navigate' ) {
        this.soundService.playSound( 'click' );
        this.goExternal( directNav.path );
        return true;
      }
    }

    const workflowGuide = this.assistantCapabilities.tryWorkflowGuide( prompt );
    if ( workflowGuide.handled && workflowGuide.kind === 'message' ) {
      this.onMessage( {
        role: 'assistant',
        content: this.assistantBoxUtilityService.normalizeModelOutputToHtml( workflowGuide.message )
      } );
      return true;
    }

    const routeIntentGuide = this.assistantCapabilities.tryRouteIntentGuide( prompt );
    if ( routeIntentGuide.handled && routeIntentGuide.kind === 'message' ) {
      this.onMessage( {
        role: 'assistant',
        content: this.assistantBoxUtilityService.normalizeModelOutputToHtml( routeIntentGuide.message )
      } );
      return true;
    }

    if ( !this.shouldHandleComposerShortcut( prompt ) ) {
      return false;
    }

    try {
      const drafted = await this.assistantComposerFlow.draftFromChat( {
        prompt,
        pageContext: null,
        userId: this.userId,
        tenantId: this.tenantId
      } );

      if ( drafted.contactResolution?.status === 'multiple' && Array.isArray( drafted.contactResolution.candidates ) ) {
        const names = drafted.contactResolution.candidates
          .slice( 0, 5 )
          .map( candidate => candidate.name )
          .filter( Boolean )
          .join( ', ' );
        const html = this.assistantBoxUtilityService.normalizeModelOutputToHtml(
          `I found a few possible matches: ${names}. Tell me which contact you want and I will open Compose for that person.`
        );
        this.onMessage( { role: 'assistant', content: html } );
        return true;
      }

      if ( drafted.messageHtml && drafted.contactResolution?.status === 'none' ) {
        this.onMessage( { role: 'assistant', content: drafted.messageHtml } );
        return true;
      }

      if ( drafted.resolvedContact ) {
        this.contactService.changeContact( drafted.resolvedContact );
      }

      // Compose Email is main-app-only and takes its draft via router state,
      // which can't cross the origin boundary to todd.taliferro.tech. The
      // draft TODD just built is announced in chat instead of silently lost.
      const body = String( drafted.payload?.html || drafted.payload?.body || '' ).trim();
      const subject = String( drafted.payload?.subject || '' ).trim();
      if ( subject || body ) {
        this.onMessage( {
          role: 'assistant',
          content: this.assistantBoxUtilityService.normalizeModelOutputToHtml(
            `<p><strong>Draft ready:</strong> ${subject || '(no subject)'}</p>${body}`
          )
        } );
      }
      this.goExternal( '/compose-email' );
      return true;
    } catch ( err: any ) {
      this.logger.warn( 'TODD composer shortcut failed', err );
      return false;
    }
  }

  private async answerGettingStarted (): Promise<void> {
    let resolution: ToddActivationResolution;

    try {
      resolution = await this.toddActivationStateService.resolveActivationState();
    } catch ( error ) {
      this.logger.warn( '[TODD] could not resolve getting-started guidance', error );
      resolution = {
        stage: 'visitor',
        recommendedRoute: { path: '/login', queryParams: {} },
        title: 'Sign in to continue setup',
        message: 'Sign in first so TODD can identify you and load the right setup steps.',
        facts: {} as ToddActivationResolution['facts']
      };
    }

    const route = this.activationRouteUrl( resolution );
    const actionByStage: Record<string, { label: string; image: string }> = {
      visitor: { label: 'Sign in', image: 'assets/TODD-icon.png' },
      profile_ready: { label: 'Update your profile', image: 'assets/TODD-icon.png' },
      sender_provisioning_required: { label: 'Provision your email address', image: 'assets/icons/outreach.png' },
      sender_pending_admin: { label: 'Check email provisioning', image: 'assets/icons/outreach.png' },
      contacts_missing: { label: 'Add or import contacts', image: 'assets/icons/network.png' }
    };
    const action = actionByStage[resolution.stage] || { label: resolution.title, image: 'assets/TODD-icon.png' };

    this.suggestedProductAction = {
      label: action.label,
      description: resolution.message,
      route,
      image: action.image
    };
    this.onMessage( {
      role: 'assistant',
      content: this.assistantBoxUtilityService.normalizeModelOutputToHtml(
        `<p><strong>Getting started with TODD:</strong></p><p>${this.getGettingStartedMessage( resolution )}</p>`
      )
    } );
  }

  private getGettingStartedMessage ( resolution: ToddActivationResolution ): string {
    switch ( resolution.stage ) {
      case 'visitor':
        return 'Sign in first. TODD needs to know who you are and which workspace to use.';
      case 'profile_ready':
        return 'You are signed in. Update your profile so TODD knows who you are, what you do, and how to guide your work.';
      case 'sender_provisioning_required':
      case 'sender_pending_admin':
        return 'Your profile is ready. Because you are using Outreach, provision your email address before TODD can send anything.';
      case 'contacts_missing':
        return 'Your profile is ready. Because you are using Network, add contacts or import them so TODD has people and relationships to work with.';
      default:
        return resolution.message;
    }
  }

  private activationRouteUrl ( resolution: ToddActivationResolution ): string {
    const query = Object.entries( resolution.recommendedRoute.queryParams || {} )
      .map( ([key, value]) => `${encodeURIComponent( key )}=${encodeURIComponent( value )}` )
      .join( '&' );
    return `${resolution.recommendedRoute.path}${query ? `?${query}` : ''}`;
  }

  private shouldRedirectMarketingPromptToMaya ( prompt: string ): boolean {
    const text = String( prompt || '' ).trim().toLowerCase();
    if ( !text ) {
      return false;
    }

    return /\bmarketing\b/.test( text );
  }

  private shouldHandleComposerShortcut ( prompt: string ): boolean {
    const text = String( prompt || '' ).toLowerCase();
    if ( this.shouldAutoNavigatePrompt( prompt ) && /\b(email composer|compose email)\b/.test( text ) ) {
      return false;
    }

    return /\b(write|draft|compose)\b/.test( text ) && /\bemail\b/.test( text );
  }

  private buildProspectHistory (): string {
    const lines: string[] = this.isLoggedIn
      ? []
      : [
        'TODD GUEST SALES MODE: The visitor is not signed in. Answer as a product guide and sales advisor, not as an internal workspace assistant.',
        'Do not claim to see, load, diagnose, or summarize the visitor\'s private business data. Explain the problem, the business value, and which Taliferro product is the best fit.',
        'Use plain language and a helpful, consultative tone. When a product is relevant, explain why it helps and invite the visitor to explore its public landing page or sign in to continue.'
      ];

    for ( const msg of this.messages ) {
      const raw = typeof msg?.content === 'string' ? msg.content : '';
      const cleaned = this.stripHtmlForPrompt( raw );
      if ( !cleaned ) continue;

      if ( msg.role === 'user' ) {
        lines.push( `Q: ${cleaned}` );
      } else {
        lines.push( `A: ${cleaned}` );
      }
    }

    return lines.join( '\n' );
  }

  private buildProspectProfileContext (): Record<string, any> | null {
    const contact = this.loggedInContact as any;
    if ( !contact ) return null;

    const company = contact.company || {};
    const products = Array.isArray( company.products )
      ? company.products
        .filter( ( product: any ) => product && product.active !== false && product.discontinued !== true )
        .slice( 0, 8 )
        .map( ( product: any ) => ( {
          name: String( product.name || product.title || '' ).trim(),
          description: String( product.shortDescription || product.description || product.problemSolved || '' ).trim(),
          audience: String( product.audience || product.idealCustomer || '' ).trim(),
          outcome: String( product.outcome || '' ).trim(),
          tags: Array.isArray( product.tags ) ? product.tags.slice( 0, 8 ) : []
        } ) )
        .filter( ( product: any ) => product.name || product.description || product.audience || product.outcome || product.tags.length > 0 )
      : [];

    const profileContext = {
      userFirstName: String( contact.firstName || '' ).trim(),
      userRole: [contact.profession, contact.status].filter( Boolean ).join( ' - ' ),
      jobDescriptionForTODD: String( contact.jobDescriptionForTODD || '' ).trim(),
      companyName: String( company.name || contact.companyName || '' ).trim(),
      companyDescription: String( company.companyDescriptionForTODD || company.description || '' ).trim(),
      companyGoal: String( company.companyGoalForTODD || company.goal || '' ).trim(),
      companyValueProp: String( company.companyValuePropForTODD || company.valueProp || '' ).trim(),
      keyProductsOrServices: String( company.companyKeyFeaturesForTODD || '' ).trim(),
      capabilities: Array.isArray( company.capabilities ) ? company.capabilities.slice( 0, 12 ) : [],
      keyFeatures: Array.isArray( company.keyFeatures ) ? company.keyFeatures.slice( 0, 12 ) : [],
      products
    };

    const hasSignal = Object.values( profileContext ).some( value => {
      if ( Array.isArray( value ) ) return value.length > 0;
      return String( value || '' ).trim().length > 0;
    } );

    return hasSignal ? profileContext : null;
  }

  private shouldUseProspectPageContext ( ctx: AssistantPageContext | null ): boolean {
    const page = String( ctx?.page || '' ).toLowerCase();
    return page === 'outbox-cockpit'
      || page === 'daily-momentum'
      || page === 'outreach-home'
      || page === 'social-outreach'
      || page === 'moves-view'
      || page === 'mission-workspace';
  }

  private resolveProspectPageContext ( prompt: string ): Observable<AssistantPageContext | null> {
    if ( this.assistantPageContext ) {
      return of( this.assistantPageContext );
    }

    if ( !this.shouldBuildHomeMomentumContext( prompt ) ) {
      return of( null );
    }

    return this.dailyCommandService.getDailyCommandPlan( String( this.tenantId || '' ), String( this.userId || '' ) )
      .pipe(
        take( 1 ),
        map( plan => this.toToddHomeMomentumContext( plan ) ),
        catchError( err => {
          this.logger.warn( 'TODD home momentum context build failed', err );
          return of( this.buildToddHomeLowDataContext() );
        } )
      );
  }

  private shouldBuildHomeMomentumContext ( prompt: string ): boolean {
    if ( !this.isLoggedIn ) return false;
    if ( !this.tenantId ) return false;
    if ( !this.userId || this.userId === 'Taliferro' ) return false;

    return /(what needs my attention|where am i losing business|what should i do this week|what am i forgetting|what is slowing my momentum|who should i contact today|what needs attention|where am i leaking|what should i do next|what is stuck|what matters most right now|what am i missing|how are we doing today|making money|momentum status|current momentum|revenue today|how much have we made|how are we doing on revenue|money today)/i.test( prompt );
  }

  private toToddHomeMomentumContext ( plan: DailyCommandPlan | null | undefined ): AssistantPageContext {
    const checklistItems = Array.isArray( plan?.checklistItems ) ? plan!.checklistItems.slice( 0, 5 ) : [];
    const blockers = Array.isArray( plan?.blockers ) ? plan!.blockers.slice( 0, 4 ) : [];
    const toddTried = Array.isArray( plan?.toddTried ) ? plan!.toddTried.slice( 0, 4 ) : [];
    const primaryAction = plan?.primaryAction || null;
    const lowData = checklistItems.length === 0 && blockers.length === 0 && toddTried.length === 0;

    const setupActions = [
      { label: 'Import contacts', route: '/network/app' },
      { label: 'Add open opportunities', route: '/network/app' },
      { label: 'Connect email', route: '/outreach/app' },
      { label: 'Create first Move', route: '/moves/app' },
      { label: 'Run data health check', route: '/network/app' }
    ];

    return {
      feature: 'todd',
      page: 'todd-home-momentum',
      route: '/todd',
      mode: 'dashboard',
      title: 'TODD Home Momentum',
      description: 'Cross-system momentum summary for TODD home chat.',
      allowedActions: lowData
        ? setupActions.map( action => `${action.label} (${action.route})` )
        : checklistItems.map( item => `${item.actionLabel}: ${item.route}` ),
      summary: {
        goalHeadline: plan?.goalHeadline || 'TODD is checking momentum across the system.',
        todaySummary: plan?.todaySummary || 'TODD is checking what needs attention right now.',
        checklistCount: checklistItems.length,
        blockerCount: blockers.length,
        triedCount: toddTried.length,
        checkedSystems: ['Moves', 'Outreach', 'Network', 'Docs', 'Pulse'],
        hasEnoughActivity: !lowData,
        primaryActionTitle: primaryAction?.title || '',
        primaryActionRoute: primaryAction?.route || ''
      },
      dataPreview: {
        primaryAction: primaryAction ? {
          title: primaryAction.title,
          reason: primaryAction.reason,
          route: primaryAction.route,
          actionLabel: primaryAction.actionLabel,
          proof: primaryAction.proof || ''
        } : null,
        checklistItems: checklistItems.map( item => ( {
          title: item.title,
          reason: item.reason,
          route: item.route,
          actionLabel: item.actionLabel,
          priority: item.priority,
          status: item.status,
          proof: item.proof || ''
        } ) ),
        blockers: blockers.map( item => ( {
          title: item.title,
          reason: item.reason,
          route: item.route,
          actionLabel: item.actionLabel,
          proof: item.proof || ''
        } ) ),
        toddTried: toddTried.map( item => ( {
          label: item.label,
          summary: item.summary,
          tone: item.tone,
          route: item.route || ''
        } ) ),
        setupActions
      }
    };
  }

  private buildToddHomeLowDataContext (): AssistantPageContext {
    return this.toToddHomeMomentumContext( {
      mode: 'operational',
      goalHeadline: 'TODD does not have enough momentum data yet.',
      todaySummary: 'I do not have enough activity yet to make a confident recommendation.',
      commandDeck: {
        eyebrow: 'TODD Command Deck',
        title: 'Today cockpit',
        subtitle: 'TODD needs more live operating data before it can make a useful command recommendation.',
        modeLabel: 'Mode',
        scoreLabel: 'Autonomy',
        scoreValue: '0%'
      },
      instrumentation: {
        readinessPercent: 0,
        modeLabel: 'Limited',
        modeDetail: 'Not enough live system data is available yet.',
        lights: []
      },
      moduleReadiness: [],
      socialGrowthDirector: null,
      userActions: [],
      primaryAction: null,
      checklistItems: [],
      blockers: [],
      outcomes: [],
      toddTried: []
    } );
  }

  private stripHtmlForPrompt ( value: string ): string {
    return ( value || '' )
      .replace( /<br\s*\/?>/gi, '\n' )
      .replace( /<\/p>/gi, '\n' )
      .replace( /<[^>]+>/g, ' ' )
      .replace( /&nbsp;/gi, ' ' )
      .replace( /&amp;/gi, '&' )
      .replace( /&lt;/gi, '<' )
      .replace( /&gt;/gi, '>' )
      .replace( /\s+\n/g, '\n' )
      .replace( /\n\s+/g, '\n' )
      .replace( /[ \t]{2,}/g, ' ' )
      .replace( /\n{3,}/g, '\n\n' )
      .trim();
  }


  private pickMediaForPrompt ( prompt: string, assistantText: string ): { item: ToddMediaItem | null; reason: string; } {
    const category = this.inferMediaCategory( `${prompt} ${this.stripHtmlForPrompt( assistantText )}` );
    const rankedVideos = this.rankMediaCandidates( VIDEOS, prompt, assistantText, category );

    if ( rankedVideos.length ) {
      return {
        item: rankedVideos[0],
        reason: rankedVideos[0].why || this.buildSuggestedMediaReason( rankedVideos[0], category )
      };
    }

    const rankedTestimonials = this.rankMediaCandidates( TESTIMONIALS, prompt, assistantText, category );
    if ( rankedTestimonials.length ) {
      return {
        item: rankedTestimonials[0],
        reason: rankedTestimonials[0].why || this.buildSuggestedMediaReason( rankedTestimonials[0], category )
      };
    }

    return { item: null, reason: '' };
  }

  private inferMediaCategory ( rawText: string ): string | null {
    const text = ( rawText || '' ).toLowerCase();

    if ( /daily momentum|daily goals?|today'?s goal|momentum page|gap remaining|revenue so far/.test( text ) ) return 'daily_momentum';
    if ( /mission|project manager|manage products|manage projects|project delivery|roadmap|milestone|drift|workspace/.test( text ) ) return 'mission';
    if ( /lead vault|buyer|buyers|purchase|buying intent/.test( text ) ) return 'lead_vault';
    if ( /document|documents|proposal|proposals|rfp|compliance|docs/.test( text ) ) return 'docs';
    if ( /knowledge|notes|answers|response flow/.test( text ) ) return 'knowledge';
    if ( /survey|feedback|customer think|response|sentiment/.test( text ) ) return 'pulse';
    if ( /ai|automation|copilot|bms|crm/.test( text ) ) return 'ai';
    if ( /lead|prospect|customer|pipeline|sales|outreach/.test( text ) ) return 'outreach';
    if ( /task|tasks|follow-up|follow up|overdue|track|tracking|todo|workflow|workflows|moves/.test( text ) ) return 'moves';

    return null;
  }

  private rankMediaCandidates ( media: ToddMediaItem[], prompt: string, assistantText: string, category: string | null ): ToddMediaItem[] {
    const combinedText = `${prompt} ${this.stripHtmlForPrompt( assistantText )}`.toLowerCase();

    return media
      .filter( item => !this.playedVideoIds.has( item.module_id ) )
      .map( item => ( {
        item,
        score: this.scoreMediaCandidate( item, combinedText, category )
      } ) )
      .filter( entry => entry.score > 0 )
      .sort( ( a, b ) => b.score - a.score )
      .map( entry => entry.item );
  }

  private scoreMediaCandidate ( item: ToddMediaItem, combinedText: string, category: string | null ): number {
    let score = 0;

    if ( category && item.best_for?.includes( category ) ) {
      score += 100;
    }

    if ( !category && item.best_for?.includes( 'all' ) ) {
      score += 20;
    }

    const keywords = Array.isArray( item.keywords ) ? item.keywords : [];
    for ( const keyword of keywords ) {
      if ( keyword && combinedText.includes( keyword.toLowerCase() ) ) {
        score += 6;
      }
    }

    const description = ( item.description || '' ).toLowerCase();
    if ( description && combinedText.includes( description ) ) {
      score += 12;
    }

    if ( item.type === 'testimonial' ) {
      score += 2;
    }

    return score;
  }

  private buildSuggestedMediaReason ( item: ToddMediaItem, category: string | null ): string {
    if ( item.why ) return item.why;

    if ( category && item.best_for?.includes( category ) ) {
      return `This ${item.type === 'testimonial' ? 'testimonial' : 'video'} lines up with what you just asked about.`;
    }

    return `This ${item.type === 'testimonial' ? 'testimonial' : 'video'} adds more context to the answer you just got.`;
  }

  private focusAssistantInput (): void {
    this.cdr.detectChanges();
    this.zone.runOutsideAngular( () => {
      requestAnimationFrame( () => {
        try {
          this.assistantInputRef?.nativeElement?.focus();
        } catch {
          // no-op
        }
      } );
    } );
  }

  onMessage ( msg: { role: 'user' | 'assistant'; content: string; } ) {
    this.messages.push( msg );


    const audience = this.isLoggedIn ? 'internal' : 'public';
    const isPublic = audience === 'public';

    // Persist to assistant history if we have an active conversation
    try {
      if ( this.assistantConversationId && this.loggedInContact ) {
        const userId =
          ( this.loggedInContact as any ).id ||
          ( this.loggedInContact as any ).uid ||
          ( this.loggedInContact as any ).loginID;

        if ( userId ) {
          const payload: AssistantMessage = {
            role: msg.role,
            content: msg.content,
            ts: Date.now(),
            visibility: isPublic ? 'public' : 'internal',
            audience,
            displayName: isPublic ? 'Someone' : this.firebaseUser?.displayName

          };
          this.assistantHistoryService.appendMessage(
            this.assistantConversationId,
            payload,
            userId
          );
        }
      }
    } catch ( err ) {
      this.logger.error( 'Assistant history append failed', err );
    }

    // Flush view so the new message is in the DOM, then scroll the container
    this.cdr.detectChanges();
    this.zone.runOutsideAngular( () => {
      // two frames guarantees layout is settled even with images/fonts
      requestAnimationFrame( () => requestAnimationFrame( () => this.scrollHistoryToBottom( true ) ) );
    } );
  }

  async onAssistantResetRequested (): Promise<void> {
    try {
      // Clear local UI immediately
      this.messages.splice( 0, this.messages.length );
      this.cdr.detectChanges();

      // Clear persisted conversation messages
      if ( !this.loggedInContact || !this.assistantConversationId ) return;

      const userId =
        ( this.loggedInContact as any ).id ||
        ( this.loggedInContact as any ).uid ||
        ( this.loggedInContact as any ).loginID;

      this.logger.info( "PARENT ATTEMPTION to DELETE History of", userId );

      if ( !userId ) return;

      await this.assistantHistoryService.clearConversationMessages( this.assistantConversationId, userId );

    } catch ( err ) {
      this.logger.error( 'TODD: clear assistant history failed', err );
    } finally {
      this.zone.runOutsideAngular( () => {
        requestAnimationFrame( () => this.scrollHistoryToBottom( false ) );
      } );
    }
  }



  processLoggedInContact (): void {
    this.getLoggedInContactInfoSubscription = this.userService
      .getLoggedInContactInfo()
      .subscribe( async ( contact ) => {
        if ( contact ) {
          this.loggedInContact = contact;
          this.profileProducts = this.isLoggedIn ? this.getActiveProfileProductsInternal() : [];
          this.logger.info( "TODD Component User Contact", this.loggedInContact );
          if ( this.loggedInContact.firstName ) {
            this.firstName = this.loggedInContact.firstName;
          }
          // Once we know who is logged in, initialize assistant history
          await this.initAssistantHistory();
        }

        this.loggedInContactResolved = true;
        this.evaluateShowcasePrompt();
        void this.maybeRunProactiveMomentumBriefing();
      } );
  }

  private async initAssistantHistory (): Promise<void> {
    try {
      if ( this.historyInitialized || !this.loggedInContact ) {
        return;
      }

      const userId =
        ( this.loggedInContact as any ).id ||
        ( this.loggedInContact as any ).uid ||
        ( this.loggedInContact as any ).loginID;

      if ( !userId ) {
        this.logger.warn( 'Assistant history: missing user id' );
        return;
      }

      const convo = await this.assistantHistoryService.getOrCreateActiveConversation( userId );
      this.assistantConversationId = convo.id;

      const msgs: AssistantMessage[] =
        await this.assistantHistoryService.loadMessages( convo.id, userId, 100 );

      this.messages = ( msgs || [] ).map( m => ( {
        role: m.role,
        content: m.content
      } ) );

      this.historyInitialized = true;

      // Refresh view and scroll to bottom so the user sees their past conversation
      this.cdr.detectChanges();
      this.zone.runOutsideAngular( () => {
        requestAnimationFrame( () => this.scrollHistoryToBottom( true ) );
      } );
    } catch ( err ) {
      this.logger.error( 'Assistant history init failed', err );
    }
  }

  refreshMomentumBriefing (): void {
    void this.maybeRunProactiveMomentumBriefing( true );
  }

  dismissShowcasePrompt (): void {
    const storageKey = this.buildShowcasePromptStorageKey();
    if ( storageKey ) {
      this.markShowcasePromptDismissed( storageKey );
    }

    this.proactiveShowcasePrompt = null;
  }

  goToShowcasePrompt (): void {
    if ( !this.proactiveShowcasePrompt?.route ) return;

    const prompt = this.proactiveShowcasePrompt;
    this.soundService.playSound( 'click' );
    this.goExternal( prompt.route, {
      toddLaunchMode: prompt.launchMode,
      toddSource: 'todd-home-showcase',
      toddModule: prompt.module
    } );
  }

  private evaluateShowcasePrompt (): void {
    if ( !this.isLoggedIn ) return;
    if ( !this.loggedInContactResolved ) return;

    const storageKey = this.buildShowcasePromptStorageKey();
    if ( storageKey && this.hasDismissedShowcasePromptToday( storageKey ) ) {
      this.proactiveShowcasePrompt = null;
      return;
    }

    const prompt = this.selectShowcasePrompt();
    this.proactiveShowcasePrompt = prompt;

    if ( prompt ) {
      this.logger.info( 'TODD showcase prompt selected', {
        module: prompt.module,
        launchMode: prompt.launchMode,
        route: prompt.route,
        tenantId: this.tenantId,
        userId: this.userId
      } );
    }
  }

  private selectShowcasePrompt (): ToddShowcasePrompt | null {
    const contact = this.loggedInContact as any;

    const contactCount = this.extractCountFromContact( contact, [
      'contactCount',
      'contactsCount',
      'networkCount',
      'peopleCount'
    ] );

    const outreachCount = this.extractCountFromContact( contact, [
      'campaignCount',
      'campaignsCount',
      'outreachCount'
    ] );

    const movesCount = this.extractCountFromContact( contact, [
      'missionCount',
      'missionsCount',
      'movesCount',
      'projectCount'
    ] );

    const surveyCount = this.extractCountFromContact( contact, [
      'surveyCount',
      'surveysCount',
      'pulseCount'
    ] );

    const docsCount = this.extractCountFromContact( contact, [
      'docCount',
      'docsCount',
      'documentCount',
      'documentsCount'
    ] );

    if ( contactCount <= 0 ) {
      return {
        module: 'network',
        headline: 'Start with one contact and let TODD show the workflow.',
        body: 'Add one email address or upload a contact. TODD will help validate it and show how Network turns raw people data into usable signal.',
        ctaLabel: 'Try Network',
        route: '/network/app',
        launchMode: 'validate-email',
        rewardText: 'Once your first contact is in, TODD can start showing what momentum looks like.'
      };
    }

    if ( outreachCount <= 0 ) {
      return {
        module: 'outreach',
        headline: 'You have people. Now create motion.',
        body: 'Give TODD an outreach goal and Maya will shape the angle, draft the emails, and keep the follow-up connected to the conversation.',
        ctaLabel: 'Try Outreach',
        route: '/outreach/app',
        launchMode: 'campaign-idea',
        rewardText: 'Put one idea in play and let TODD show how it thinks.'
      };
    }

    if ( movesCount <= 0 ) {
      return {
        module: 'moves',
        headline: 'Turn a goal into a tracked mission.',
        body: 'Open Mission Workspace, tell TODD the outcome you want, and let it help turn that into moves.',
        ctaLabel: 'Try Mission Workspace',
        route: '/mission',
        launchMode: 'mission-intake',
        rewardText: 'One mission is enough to show how TODD helps work move forward.'
      };
    }

    if ( surveyCount <= 0 ) {
      return {
        module: 'pulse',
        headline: 'Let TODD draft a survey for you.',
        body: 'Give TODD your organization name and let it generate a survey you can refine inside Pulse.',
        ctaLabel: 'Try Pulse',
        route: '/pulse/app',
        launchMode: 'survey-generator',
        rewardText: 'A fast survey draft is a quick way to see TODD create something useful.'
      };
    }

    if ( docsCount <= 0 ) {
      return {
        module: 'docs',
        headline: 'Show TODD a document and let it work.',
        body: 'Upload a document in Docs and let TODD help edit, tighten, or improve it so the value is obvious.',
        ctaLabel: 'Try Docs',
        route: '/docs/app',
        launchMode: 'doc-editor',
        rewardText: 'A visible before-and-after edit is one of the fastest proof moments.'
      };
    }

    return {
      module: 'network',
      headline: 'You have started. Now let TODD do more.',
      body: 'Pick one module and give TODD something real to work so it can prove more value inside your daily flow.',
      ctaLabel: 'Open Network',
      route: '/network/app',
      launchMode: 'validate-email',
      rewardText: 'The more real context you give TODD, the more useful it gets.'
    };
  }

  private extractCountFromContact ( contact: any, keys: string[] ): number {
    for ( const key of keys ) {
      const rawValue = contact?.[key];
      const normalized = this.normalizeCountValue( rawValue );
      if ( normalized !== null ) {
        return normalized;
      }
    }

    return 0;
  }

  private normalizeCountValue ( value: any ): number | null {
    if ( typeof value === 'number' && Number.isFinite( value ) ) {
      return Math.max( 0, value );
    }

    if ( typeof value === 'string' ) {
      const parsed = Number( value );
      if ( Number.isFinite( parsed ) ) {
        return Math.max( 0, parsed );
      }
    }

    if ( Array.isArray( value ) ) {
      return value.length;
    }

    return null;
  }

  private buildShowcasePromptStorageKey (): string {
    const tenantId = String( this.tenantId || '' ).trim();
    const userId = String(
      ( this.loggedInContact as any )?.id
      || ( this.loggedInContact as any )?.uid
      || ( this.loggedInContact as any )?.loginID
      || this.userId
      || ''
    ).trim();

    if ( !tenantId || !userId ) {
      return '';
    }

    return `${this.showcaseStoragePrefix}:${tenantId}:${userId}:${this.getLocalDateKey()}`;
  }

  private hasDismissedShowcasePromptToday ( storageKey: string ): boolean {
    try {
      return localStorage.getItem( storageKey ) === 'dismissed';
    } catch {
      return false;
    }
  }

  private markShowcasePromptDismissed ( storageKey: string ): void {
    try {
      localStorage.setItem( storageKey, 'dismissed' );
    } catch {
      // no-op
    }
  }

  private watchMomentumBriefingReadiness (): void {
    this.proactiveMomentumStateSubscription = combineLatest( [
      this.ready$,
      this.authService.isLoggedIn()
    ] )
      .pipe( filter( ( [isReady, isLoggedIn] ) => Boolean( isReady ) && Boolean( isLoggedIn ) ) )
      .subscribe( () => {
        void this.maybeRunProactiveMomentumBriefing();
      } );
  }

  private async maybeRunProactiveMomentumBriefing ( force: boolean = false ): Promise<void> {
    if ( !this.isBrowser ) return;
    if ( !this.isLoggedIn ) return;
    if ( !this.tenantId ) return;
    // The contact record can resolve after auth on a fresh session. The tenant
    // and user identity are sufficient to run the briefing; waiting on the
    // optional contact lookup made the proactive check silently disappear.
    if ( !this.loggedInContactResolved && !this.userId ) return;
    if ( this.proactiveShowcasePrompt ) {
      this.proactiveMomentumAction = null;
      this.proactiveMomentumChecklist = null;
      return;
    }

    const configuredGoal = Math.max( Number( this.goalService.getDailyRevenueGoalAmount() || 0 ), 0 );
    if ( configuredGoal <= 0 ) {
      this.proactiveMomentumAction = null;
      this.proactiveMomentumChecklist = null;
      return;
    }

    const momentumDailyKey = this.buildMomentumBriefingDailyKey();
    if ( !momentumDailyKey ) return;

    if ( !force && this.hasShownMomentumBriefingToday( momentumDailyKey ) ) {
      return;
    }

    if ( this.proactiveMomentumInFlight ) {
      return;
    }

    this.proactiveMomentumInFlight = true;

    this.goalService.getMomentumCheck( String( this.tenantId ), this.goalService.getDailyRevenueGoalAmount() )
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( response ) => {
          const briefing = this.goalService.formatToddHomeMomentumBriefing( response );
          this.proactiveMomentumAction = briefing.action;
          this.proactiveMomentumChecklist = briefing.approvalChecklist;

          if ( briefing.shouldDisplay && briefing.html ) {
            this.onMessage( {
              role: 'assistant',
              content: briefing.html
            } );
          }

          this.markMomentumBriefingShown( momentumDailyKey );
          this.proactiveMomentumInFlight = false;
        },
        error: ( err ) => {
          this.proactiveMomentumInFlight = false;
          this.logger.error( 'TODD proactive momentum briefing failed', err );
        }
      } );
  }

  private buildMomentumBriefingDailyKey (): string {
    const tenantId = String( this.tenantId || '' ).trim();
    const userId = String(
      ( this.loggedInContact as any )?.id
      || ( this.loggedInContact as any )?.uid
      || ( this.loggedInContact as any )?.loginID
      || this.userId
      || ''
    ).trim();

    if ( !tenantId || !userId ) {
      return '';
    }

    return `${this.proactiveMomentumStoragePrefix}:${tenantId}:${userId}:${this.getLocalDateKey()}`;
  }

  private hasShownMomentumBriefingToday ( storageKey: string ): boolean {
    try {
      return localStorage.getItem( storageKey ) === '1';
    } catch {
      return false;
    }
  }

  private markMomentumBriefingShown ( storageKey: string ): void {
    try {
      localStorage.setItem( storageKey, '1' );
    } catch {
      // no-op
    }
  }

  private getLocalDateKey (): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String( now.getMonth() + 1 ).padStart( 2, '0' );
    const day = String( now.getDate() ).padStart( 2, '0' );
    return `${year}-${month}-${day}`;
  }


  private scrollHistoryToBottom ( smooth: boolean = false ) {
    try {
      const messageContent = this.historyRef?.nativeElement as HTMLElement | null;
      const el = messageContent?.closest<HTMLElement>( '.todd-focused-history' ) || messageContent;
      if ( !el ) return;

      const top = el.scrollHeight;

      // Prefer smooth element scrolling when available; otherwise fall back to scrollTop
      const canSmoothScroll = smooth && typeof ( el as any ).scrollTo === 'function';
      if ( canSmoothScroll ) {
        ( el as any ).scrollTo( { top, behavior: 'smooth' } );
      } else {
        el.scrollTop = top;
      }
    } catch {
      // no-op
    }
  }



  playSuggestedVideo (): void {
    if ( !this.suggestedVideo ) return;

    const media = this.suggestedVideo;
    this.activeVideo = media;
    this.activeVideoEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl( this.toEmbedUrl( media.url ) );
    this.playedVideoIds.add( media.module_id );
    this.trackToddMediaEvent( 'todd_media_played', media, {
      isLoggedIn: this.isLoggedIn,
      reason: this.suggestedVideoReason || media.why || ''
    } );
    this.suggestedVideoReason = '';
    this.suggestedVideo = null;
  }

  dismissSuggestedVideo (): void {
    if ( !this.suggestedVideo ) return;

    const media = this.suggestedVideo;
    this.playedVideoIds.add( media.module_id );
    this.trackToddMediaEvent( 'todd_media_dismissed', media, {
      isLoggedIn: this.isLoggedIn,
      reason: this.suggestedVideoReason || media.why || ''
    } );
    this.suggestedVideoReason = '';
    this.suggestedVideo = null;
  }

  closeActiveVideo (): void {
    this.activeVideo = null;
    this.activeVideoEmbedUrl = '';
  }

  private trackToddMediaEvent ( eventName: string, media: ToddMediaItem, extra: Record<string, any> = {} ): void {
    try {
      this.logger.info( eventName, {
        module_id: media.module_id,
        type: media.type,
        best_for: media.best_for,
        orientation: media.orientation,
        description: media.description,
        ...extra,
        ts: new Date().toISOString()
      } );
    } catch {
      // no-op
    }
  }

  private toEmbedUrl ( rawUrl: string ): string {
    const url = ( rawUrl || '' ).trim();
    if ( !url ) return '';

    const shortMatch = url.match( /youtube\.com\/shorts\/([^?&/]+)/i );
    if ( shortMatch?.[1] ) {
      return `https://www.youtube.com/embed/${shortMatch[1]}?autoplay=1&rel=0`;
    }

    const watchMatch = url.match( /[?&]v=([^?&/]+)/i );
    if ( watchMatch?.[1] ) {
      return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&rel=0`;
    }

    const youtuBeMatch = url.match( /youtu\.be\/([^?&/]+)/i );
    if ( youtuBeMatch?.[1] ) {
      return `https://www.youtube.com/embed/${youtuBeMatch[1]}?autoplay=1&rel=0`;
    }

    return url;
  }

  private buildSuggestedProductAction ( category: string | null, prompt: string = '', assistantText: string = '' ): { label: string; description: string; route: string; image: string; } | null {
    const products = this.profileProducts;
    const fallbackAction = this.buildDefaultSuggestedProductAction( category, prompt, assistantText );
    const matchedProduct = this.findBestProfileProductMatch( `${category || ''} ${prompt}`, assistantText );

    if ( matchedProduct ) {
      const name = this.getProductDisplayName( matchedProduct );
      const route = this.getProductRoute( matchedProduct );

      if ( route ) {
        return {
          label: String( matchedProduct?.callToAction || `Explore ${name}` ).trim(),
          description: this.getProductDescription( matchedProduct ) || `See how ${name} can help with this next step.`,
          route: this.getProductLandingRoute( route ),
          image: this.getProductImage( matchedProduct )
        };
      }
    }

    if ( products.length ) {
      const product = products[0];
      const name = this.getProductDisplayName( product );
      const route = this.getProductRoute( product );

      if ( route ) {
        return {
          label: String( product?.callToAction || `Explore ${name}` ).trim(),
          description: this.getProductDescription( product ) || `Start with ${name}.`,
          route: this.getProductLandingRoute( route ),
          image: this.getProductImage( product )
        };
      }
    }

    return fallbackAction;
  }

  private buildDefaultSuggestedProductAction (
    category: string | null,
    prompt: string = '',
    assistantText: string = ''
  ): { label: string; description: string; route: string; image: string; } | null {
    const promptText = this.normalizeProductSearchText( `${category || ''} ${prompt}` );
    const text = this.normalizeProductSearchText( `${promptText} ${this.stripHtmlForPrompt( assistantText )}` );

    if ( /signature|email signature/.test( promptText ) ) {
      return {
        label: 'Open Email Signature Builder',
        description: 'Create a polished email signature your team can use.',
        route: getSignatureBuilderUrl(),
        image: 'assets/outreach/email-signature-builder.png'
      };
    }

    if ( /pulse|survey|feedback|sentiment|signals?/.test( promptText ) ) {
      return {
        label: 'Open Pulse',
        description: 'Collect feedback and turn responses into action.',
        route: getPulseHomeUrl(),
        image: 'assets/pulse/pulse.png'
      };
    }

    if ( /contact|contacts|network|lead vault|lead|prospect|crm|data/.test( promptText ) ) {
      return {
        label: 'Open Network',
        description: 'Manage contacts, leads, and relationship data in one place.',
        route: getNetworkHomeUrl(),
        image: 'assets/network/network.png'
      };
    }

    if ( /outreach|campaign|email|follow up|follow-up|pipeline|sales/.test( promptText ) ) {
      return {
        label: 'Open Outreach',
        description: 'Let Maya prepare relevant individual email and follow-up from the conversation context.',
        route: 'https://outreach.taliferro.tech',
        image: 'assets/outreach/outreach.png'
      };
    }

    if ( /task|tasks|moves|project|mission|workflow/.test( promptText ) ) {
      return {
        label: 'Open Moves',
        description: 'Track next actions and keep work moving.',
        route: 'https://moves.taliferro.tech',
        image: 'assets/moves/moves.png'
      };
    }

    if ( /docs|document|proposal|rfp|knowledge/.test( promptText ) ) {
      return {
        label: 'Open Docs',
        description: 'Store, refine, and generate business documents.',
        route: 'https://docs.taliferro.tech',
        image: 'assets/docs/docs.png'
      };
    }

    if ( /social|linkedin|threads|bluesky|reddit|instagram|facebook|visibility|content/.test( promptText ) ) {
      return {
        label: 'Open Social',
        description: 'Turn useful business activity into platform-ready posts, review the drafts, and keep your public visibility moving.',
        route: getSocialHomeUrl(),
        image: 'assets/todd-social-icon.png'
      };
    }

    if ( /sayit|chat|message|internal social|post/.test( promptText ) ) {
      return {
        label: 'Open SayIt',
        description: 'Share updates, requests, and opportunities internally.',
        route: getSayitHomeUrl(),
        image: 'assets/sayit/sayit.png'
      };
    }


    if ( /pulse|survey|feedback|sentiment|signals?/.test( text ) ) {
      return {
        label: 'Open Pulse',
        description: 'Collect feedback and turn responses into action.',
        route: getPulseHomeUrl(),
        image: 'assets/pulse/pulse.png'
      };
    }

    if ( /contact|contacts|network|lead vault|lead|prospect|crm|data/.test( text ) ) {
      return {
        label: 'Open Network',
        description: 'Manage contacts, leads, and relationship data in one place.',
        route: getNetworkHomeUrl(),
        image: 'assets/network/network.png'
      };
    }

    if ( /outreach|campaign|email|follow up|follow-up|pipeline|sales/.test( text ) ) {
      return {
        label: 'Open Outreach',
        description: 'Let Maya prepare relevant individual email and follow-up from the conversation context.',
        route: 'https://outreach.taliferro.tech',
        image: 'assets/outreach/outreach.png'
      };
    }

    if ( /task|tasks|moves|project|mission|workflow/.test( text ) ) {
      return {
        label: 'Open Moves',
        description: 'Track next actions and keep work moving.',
        route: 'https://moves.taliferro.tech',
        image: 'assets/moves/moves.png'
      };
    }

    if ( /docs|document|proposal|rfp|knowledge/.test( text ) ) {
      return {
        label: 'Open Docs',
        description: 'Store, refine, and generate business documents.',
        route: 'https://docs.taliferro.tech',
        image: 'assets/docs/docs.png'
      };
    }

    if ( /social|linkedin|threads|bluesky|reddit|instagram|facebook|visibility|content/.test( text ) ) {
      return {
        label: 'Open Social',
        description: 'Turn useful business activity into platform-ready posts, review the drafts, and keep your public visibility moving.',
        route: getSocialHomeUrl(),
        image: 'assets/todd-social-icon.png'
      };
    }

    if ( /sayit|chat|message|internal social|post/.test( text ) ) {
      return {
        label: 'Open SayIt',
        description: 'Share updates, requests, and opportunities internally.',
        route: getSayitHomeUrl(),
        image: 'assets/sayit/sayit.png'
      };
    }


    return {
      label: 'Open Network',
      description: 'Start with the core system that keeps momentum organized.',
      route: getNetworkHomeUrl(),
      image: 'assets/network/network.png'
    };
  }

  goToSuggestedProduct (): void {
    const route = this.suggestedProductAction?.route;
    if ( !route ) return;
    this.soundService.playSound( 'click' );
    // Routes that were already absolute (e.g. the Signature Builder link)
    // leave the whole TODD ecosystem, so open a new tab rather than
    // abandoning the chat session; everything else replaces this tab, same
    // as the monolith's in-app router.navigate did.
    this.goExternal( route, undefined, /^https?:\/\//i.test( route ) );
  }

  goToMomentumAction (): void {
    if ( !this.proactiveMomentumAction?.route ) return;
    this.soundService.playSound( 'click' );
    this.goExternal( this.proactiveMomentumAction.route );
  }



}
