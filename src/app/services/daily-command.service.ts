import { Injectable } from '@angular/core';
import { combineLatest, map, Observable, of, catchError, switchMap } from 'rxjs';

import {
  DailyMomentumActionRow,
  DailyMomentumApprovalAction,
  DailyMomentumAuditItem,
  DailyMomentumViewModel,
  GoalService,
  ToddMomentumEngineState
} from './goal.service';
import { LoggerService } from './logger.service';
import { TaskService } from './task.service';
import { Task } from '../shared/data/interfaces/task.model';
import { UserService } from './user.service';
import { Contact } from '../shared/data/interfaces/contact.model';
import { AdminControlService } from './admin-control.service';
import { OutreachApiService, SocialAccount, SocialBootstrapPayload, SocialDraftStrategyContext, SocialPost } from './outreach-api.service';
import { SurveyApiService } from '../features/survey/services/survey-api.service';
import { Survey } from '../features/survey/models/survey.model';

export type DailyCommandPriority = 'high' | 'medium' | 'low';
export type DailyCommandStatus = 'needs_you' | 'ready' | 'blocked' | 'waiting';
export type DailyCommandAutonomyLevel = 'auto' | 'auto_after_timeout' | 'requires_approval';
export type DailyCommandModuleKey = 'network' | 'outreach' | 'social' | 'moves' | 'docs' | 'pulse';
export type DailyCommandModuleState = 'ready' | 'attention' | 'blocked';
export type DailyCommandSource =
  | 'setup'
  | 'attention'
  | 'approval'
  | 'signal'
  | 'campaign_gap'
  | 'overdue_move'
  | 'goal_recovery'
  | 'fallback';

export interface DailyCommandItem {
  id: string;
  title: string;
  reason: string;
  route: string;
  actionLabel: string;
  priority: DailyCommandPriority;
  status: DailyCommandStatus;
  source: DailyCommandSource;
  autonomyLevel: DailyCommandAutonomyLevel;
  module?: DailyCommandModuleKey;
  autonomyNote?: string;
  proof?: string;
}

export interface DailyCommandOutcome {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: 'info' | 'positive' | 'attention';
}

export interface DailyCommandEvidence {
  id: string;
  label: string;
  summary: string;
  tone: 'info' | 'positive' | 'attention' | 'warn';
  route?: string;
}

export interface DailyCommandDeck {
  eyebrow: string;
  title: string;
  subtitle: string;
  modeLabel: string;
  scoreLabel: string;
  scoreValue: string;
}

export interface DailyCommandInstrumentationLight {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: DailyCommandEvidence['tone'];
  pulse?: boolean;
}

export interface DailyCommandInstrumentation {
  readinessPercent: number;
  modeLabel: string;
  modeDetail: string;
  lights: DailyCommandInstrumentationLight[];
}

export interface DailyCommandModuleReadiness {
  key: DailyCommandModuleKey;
  label: string;
  state: DailyCommandModuleState;
  stateLabel: string;
  detail: string;
  route: string;
  indicatorTone: DailyCommandEvidence['tone'];
  progressPercent: number;
  progressLabel: string;
  proof?: string;
  userActionCount: number;
}

type MomentumOpenAlert = NonNullable<ToddMomentumEngineState['openAlerts']>[number];

export interface DailyCommandPlan {
  mode: 'operational' | 'onboarding';
  goalHeadline: string;
  todaySummary: string;
  commandDeck: DailyCommandDeck;
  instrumentation: DailyCommandInstrumentation;
  moduleReadiness: DailyCommandModuleReadiness[];
  socialGrowthDirector?: DailyCommandSocialGrowthDirector | null;
  userActions: DailyCommandItem[];
  primaryAction: DailyCommandItem | null;
  checklistItems: DailyCommandItem[];
  blockers: DailyCommandItem[];
  outcomes: DailyCommandOutcome[];
  toddTried: DailyCommandEvidence[];
}

export interface DailyCommandSocialGrowthDirector {
  postId: string;
  platformLabel: string;
  status: string;
  statusLabel: string;
  diagnosis: string;
  toddNextMove: string;
  userActionTitle: string | null;
  userActionInstruction: string | null;
  userActionReason: string | null;
  userActionLabel: string | null;
  route: string | null;
  nextCheckLabel: string | null;
  proof: string | null;
  recoveryDraftPostId?: string | null;
}

interface DailyCommandIntegrationState {
  tenant: any | null;
  socialAccounts: SocialAccount[];
  hasConnectedSocialAccounts: boolean;
  hasProvisionedSender: boolean;
  surveys: Survey[] | null;
}

@Injectable( {
  providedIn: 'root'
} )
export class DailyCommandService {

  constructor (
    private readonly goalService: GoalService,
    private readonly taskService: TaskService,
    private readonly logger: LoggerService,
    private readonly userService: UserService,
    private readonly adminControlService: AdminControlService,
    private readonly outreachApi: OutreachApiService,
    private readonly surveyApi: SurveyApiService
  ) { }

  getDailyCommandPlan ( tenantId: string, userId: string ): Observable<DailyCommandPlan> {
    const goalAmount = this.goalService.getDailyRevenueGoalAmount();

    return this.outreachApi.listSocialAccounts( { tenantId, userId } ).pipe(
      map( response => Array.isArray( response?.data ) ? response.data : [] ),
      catchError( error => {
        this.logger.warn( 'DailyCommandService.getDailyCommandPlan social account load failed', error );
        return of( [] as SocialAccount[] );
      } ),
      switchMap( socialAccounts => {
        const socialBootstrap$ = this.hasConnectedSocialAccounts( socialAccounts )
          ? this.outreachApi.getSocialBootstrap( {
            tenantId,
            userId,
            limit: 12,
            activityLimit: 4,
            debugSlim: true
          } ).pipe(
            map( response => response?.data || null ),
            catchError( error => {
              this.logger.warn( 'DailyCommandService.getDailyCommandPlan social bootstrap load failed', error );
              return of( null as SocialBootstrapPayload | null );
            } )
          )
          : of( null as SocialBootstrapPayload | null );

        return combineLatest( [
          this.goalService.getMomentumBootstrap( tenantId, goalAmount, {
            activityLimit: 4,
            receiptLimit: 6,
            actionPlanLimit: 16
          } ).pipe(
            map( response => response?.data || {} ),
            catchError( error => {
              this.logger.error( 'DailyCommandService.getDailyCommandPlan momentum bootstrap failed', error );
              return of( {} );
            } )
          ),
          this.taskService.loadTasks( userId ).pipe(
            catchError( error => {
              this.logger.warn( 'DailyCommandService.getDailyCommandPlan task load failed', error );
              return of( [] as Task[] );
            } )
          ),
          this.userService.getLoggedInContactInfo( true ).pipe(
            catchError( error => {
              this.logger.warn( 'DailyCommandService.getDailyCommandPlan contact load failed', error );
              return of( null as Contact | null );
            } )
          ),
          this.goalService.getCalendarConnectionStatus().pipe(
            map( response => response?.data || {} ),
            catchError( error => {
              this.logger.warn( 'DailyCommandService.getDailyCommandPlan calendar status load failed', error );
              return of( {} );
            } )
          ),
          this.adminControlService.getTenant$( tenantId ).pipe(
            catchError( error => {
              this.logger.warn( 'DailyCommandService.getDailyCommandPlan tenant load failed', error );
              return of( null );
            } )
          ),
          of( socialAccounts ),
          socialBootstrap$,
          this.surveyApi.listSurveys( {
            pageSize: 100,
            filters: { sortBy: 'updatedAt', sortDirection: 'desc' }
          } ).pipe(
            map( response => Array.isArray( response?.surveys ) ? response.surveys : [] ),
            catchError( error => {
              this.logger.warn( 'DailyCommandService.getDailyCommandPlan survey load failed', error );
              return of( null as Survey[] | null );
            } )
          )
        ] );
      } ),
      map( ( [bootstrap, tasks, contact, calendarStatus, tenant, socialAccounts, socialBootstrap, surveys] ) =>
        this.buildPlan( bootstrap, tasks, contact, calendarStatus, goalAmount, { tenant, socialAccounts, socialBootstrap, surveys } )
      )
    );
  }

  buildPlan (
    bootstrap: any,
    tasks: Task[] = [],
    contact: Contact | null = null,
    calendarStatus: any = null,
    selectedGoalAmount: number = this.goalService.getDailyRevenueGoalAmount(),
    rawIntegrationState: { tenant?: any | null; socialAccounts?: SocialAccount[]; socialBootstrap?: SocialBootstrapPayload | null; surveys?: Survey[] | null; } = {}
  ): DailyCommandPlan {
    const momentumSnapshot = bootstrap?.momentumSnapshot || {};
    const rawViewModel = this.goalService.buildDailyMomentumViewModel( { data: momentumSnapshot } );
    const viewModel = this.normalizeGoalSnapshot( rawViewModel, selectedGoalAmount );
    const engineState = ( bootstrap?.engineState || momentumSnapshot?.engineState || null ) as ToddMomentumEngineState | null;
    const socialQueueSummary = momentumSnapshot?.socialQueueSummary || {};
    const receiptsSummary = bootstrap?.receipts?.summary || {};
    const receiptsFeed = Array.isArray( bootstrap?.receipts?.feed ) ? bootstrap.receipts.feed : [];
    const integrationState = this.buildIntegrationState(
      rawIntegrationState.tenant || null,
      rawIntegrationState.socialAccounts || [],
      rawIntegrationState.surveys
    );
    const socialGrowthDirector = this.buildSocialGrowthDirector( rawIntegrationState.socialBootstrap || null, integrationState );

    if ( this.shouldUseOnboardingPlan( contact, viewModel, engineState, calendarStatus, integrationState ) ) {
      return this.buildOnboardingPlan( contact, viewModel, engineState, calendarStatus, integrationState );
    }

    const checklistItems = [
      ...this.buildSetupItems( viewModel, engineState, calendarStatus, integrationState ),
      ...this.buildApprovalItems( viewModel, integrationState ),
      ...this.buildHotSignalItems( viewModel, engineState, integrationState ),
      ...this.buildCampaignGapItems( viewModel, socialQueueSummary, receiptsSummary, integrationState ),
      ...this.buildOverdueMoveItems( tasks, viewModel ),
    ];

    const dedupedChecklist = this.deduplicateItems( checklistItems );
    const rankedChecklist = this.rankChecklist( dedupedChecklist );
    const finalChecklistRaw = rankedChecklist.length ? rankedChecklist : this.buildFallbackChecklist( viewModel, integrationState );
    const finalChecklist = this.attachModules( finalChecklistRaw );
    const blockers = finalChecklist.filter( item => item.status === 'blocked' );
    const outcomes = this.buildOutcomes( viewModel, engineState, receiptsFeed, socialQueueSummary, integrationState );
    const moduleReadiness = this.buildModuleReadiness( 'operational', finalChecklist, blockers, outcomes, viewModel, engineState, contact, calendarStatus, tasks, integrationState );
    const userActions = this.buildUserActions( finalChecklist );
    const commandDeck = this.buildCommandDeck( 'operational', viewModel, finalChecklist, moduleReadiness );
    const instrumentation = this.buildInstrumentation( 'operational', moduleReadiness, finalChecklist, outcomes );

    return {
      mode: 'operational',
      goalHeadline: this.buildGoalHeadline( viewModel ),
      todaySummary: this.buildTodaySummary( viewModel, engineState, finalChecklist, outcomes ),
      commandDeck,
      instrumentation,
      moduleReadiness,
      socialGrowthDirector,
      userActions,
      primaryAction: this.selectPrimaryAction( finalChecklist ),
      checklistItems: finalChecklist,
      blockers,
      outcomes,
      toddTried: this.buildToddTried( viewModel, engineState, receiptsFeed, calendarStatus, integrationState )
    };
  }

  private buildOnboardingPlan (
    contact: Contact | null,
    viewModel: DailyMomentumViewModel,
    engineState: ToddMomentumEngineState | null,
    calendarStatus: any = null,
    integrationState: DailyCommandIntegrationState
  ): DailyCommandPlan {
    const calendarConnected = this.isCalendarConnected( calendarStatus );
    const profileReady = this.hasCoreProfile( contact );
    const stripeNotice = viewModel.stripeConnectionNotice;
    const calendarNeedsSetup = !!viewModel.calendarConnectionNotice && !this.hasHealthyCalendarConnection( engineState, calendarStatus );
    const senderReady = integrationState.hasProvisionedSender;
    const socialReady = integrationState.hasConnectedSocialAccounts;
    const checklistItems: DailyCommandItem[] = [
      {
        id: 'onboarding-profile',
        title: profileReady ? 'Profile complete' : 'Complete your profile',
        reason: profileReady
          ? 'TODD already has your core identity and business context. You can revisit this any time if your positioning changes.'
          : 'Tell TODD who you are, what your company does, and what kind of help you want so every draft and recommendation starts from real context.',
        route: '/update-profile?guided=profile&forceProfileSetup=1',
        actionLabel: profileReady ? 'Review Profile' : 'Finish Profile Setup',
        priority: 'high',
        status: profileReady ? 'ready' : 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval'
      },
      {
        id: 'onboarding-revenue',
        title: stripeNotice ? 'Connect your revenue source' : 'Choose how TODD should help',
        reason: stripeNotice?.message
          || 'Tell TODD how hands-on you want it to be with momentum before you turn on deeper operational behavior.',
        route: stripeNotice ? '/billing' : '/daily-momentum?tab=operator',
        actionLabel: stripeNotice?.actionLabel || ( stripeNotice ? 'Open Billing' : 'Open Operator Controls' ),
        priority: 'medium',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval'
      },
      {
        id: 'onboarding-calendar',
        title: calendarConnected && !calendarNeedsSetup ? 'Review your calendar connection' : 'Connect a calendar',
        reason: calendarConnected && !calendarNeedsSetup
          ? 'Your calendar is already connected. Review how TODD will use meeting activity in your daily guidance.'
          : viewModel.calendarConnectionNotice?.message || 'Connect a calendar when you want TODD to understand meeting activity and schedule pressure.',
        route: '/daily-momentum?tab=operator',
        actionLabel: viewModel.calendarConnectionNotice?.actionLabel || ( calendarConnected && !calendarNeedsSetup ? 'Review Calendar Setup' : 'Connect Calendar' ),
        priority: 'medium',
        status: calendarConnected && !calendarNeedsSetup ? 'ready' : 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval'
      },
      {
        id: 'onboarding-contacts',
        title: 'Need to import contacts?',
        reason: 'Bring in a CSV or add a few people manually so TODD has real relationships to organize and support.',
        route: '/contact-import',
        actionLabel: 'Import Contacts',
        priority: 'medium',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval'
      },
      {
        id: 'onboarding-inbox',
        title: 'Would you like to see your email in TODD?',
        reason: 'Connect inbox access when you want TODD to help read, draft, and track email work from one place.',
        route: '/inbox-access',
        actionLabel: 'Open Inbox Access',
        priority: 'medium',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval'
      }
    ];

    if ( !senderReady ) {
      checklistItems.push( {
        id: 'onboarding-sender',
        title: 'Finish sending setup',
        reason: 'TODD should not claim outreach work until your sender has actually been provisioned from Admin Control.',
        route: '/admin',
        actionLabel: 'Open Admin Control',
        priority: 'high',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval'
      } );
    }

    if ( !socialReady ) {
      checklistItems.push( {
        id: 'onboarding-social',
        title: 'Connect social accounts',
        reason: 'TODD should not talk about drafts, publishing, or social momentum until at least one real account is connected.',
        route: '/outreach/social/accounts',
        actionLabel: 'Open Connected Accounts',
        priority: 'medium',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval'
      } );
    }

    const outcomes: DailyCommandOutcome[] = [
      {
        id: 'onboarding-outcome-profile',
        label: 'Profile context',
        value: profileReady ? 'Ready' : 'Needed',
        detail: profileReady
          ? 'TODD already has your core business context.'
          : 'Share your name, company, and business description so TODD can personalize correctly.',
        tone: profileReady ? 'positive' : 'attention'
      },
      {
        id: 'onboarding-outcome-revenue',
        label: 'Revenue source',
        value: stripeNotice ? 'Needed' : 'Ready',
        detail: stripeNotice
          ? 'Connect Stripe before TODD starts talking about revenue pressure or progress.'
          : 'Revenue inputs are ready for TODD to use.',
        tone: stripeNotice ? 'attention' : 'positive'
      },
      {
        id: 'onboarding-outcome-calendar',
        label: 'Calendar',
        value: calendarConnected && !calendarNeedsSetup ? 'Connected' : 'Optional',
        detail: calendarConnected && !calendarNeedsSetup
          ? 'TODD can use meeting activity as part of its guidance.'
          : 'Connect a calendar when you want meeting-aware recommendations.',
        tone: calendarConnected && !calendarNeedsSetup ? 'positive' : 'info'
      },
      {
        id: 'onboarding-outcome-sender',
        label: 'Sending',
        value: senderReady ? 'Ready' : 'Needed',
        detail: senderReady
          ? 'Outreach sender provisioning is ready.'
          : 'Finish sender provisioning before TODD claims any outreach execution.',
        tone: senderReady ? 'positive' : 'attention'
      },
      {
        id: 'onboarding-outcome-social',
        label: 'Social',
        value: socialReady ? 'Connected' : 'Needed',
        detail: socialReady
          ? 'At least one real social account is connected.'
          : 'Connect a real social account before TODD claims social drafts or publishing work.',
        tone: socialReady ? 'positive' : 'info'
      }
    ];

    const toddTried: DailyCommandEvidence[] = [
      {
        id: 'onboarding-evidence-profile',
        label: 'Profile check',
        summary: profileReady
          ? 'Core profile fields are already in place.'
          : 'TODD is still missing the business context it uses to personalize drafts and decisions.',
        tone: profileReady ? 'positive' : 'attention'
      },
      {
        id: 'onboarding-evidence-calendar',
        label: calendarConnected ? 'Calendar connected' : 'Calendar not connected',
        summary: calendarConnected
          ? this.buildConnectedCalendarSummary( calendarStatus )
          : 'Connect a calendar when you want TODD to understand meetings and schedule pressure.',
        tone: calendarConnected ? 'positive' : 'info'
      },
      {
        id: 'onboarding-evidence-contacts',
        label: 'Contacts import',
        summary: 'Import contacts when you want TODD to organize people, follow-up opportunities, and relationship coverage.',
        tone: 'info'
      },
      {
        id: 'onboarding-evidence-inbox',
        label: 'Inbox access',
        summary: 'Open Inbox Access if you want TODD to help you see and work your email inside the platform.',
        tone: 'info'
      },
      {
        id: 'onboarding-evidence-sender',
        label: senderReady ? 'Sending provisioned' : 'Sending not provisioned',
        summary: senderReady
          ? 'Admin provisioning is in place, so TODD can truthfully talk about outreach execution.'
          : 'TODD is still missing sender provisioning, so outreach claims should stay off the Today screen.',
        tone: senderReady ? 'positive' : 'attention'
      },
      {
        id: 'onboarding-evidence-social',
        label: socialReady ? 'Social connected' : 'Social not connected',
        summary: socialReady
          ? 'TODD has at least one real social account to work with.'
          : 'TODD should stay quiet about social drafts and publishing until a real account exists.',
        tone: socialReady ? 'positive' : 'info'
      }
    ];

    const finalChecklist = this.attachModules( checklistItems );
    const moduleReadiness = this.buildModuleReadiness( 'onboarding', finalChecklist, [], outcomes, viewModel, engineState, contact, calendarStatus, [], integrationState );
    const userActions = this.buildUserActions( finalChecklist );
    const commandDeck = this.buildCommandDeck( 'onboarding', viewModel, finalChecklist, moduleReadiness );
    const instrumentation = this.buildInstrumentation( 'onboarding', moduleReadiness, finalChecklist, outcomes );

    return {
      mode: 'onboarding',
      goalHeadline: 'New users start at zero here until the real systems are connected.',
      todaySummary: 'Right now TODD should stay honest: finish setup, connect the systems you actually want in play, and then the Today screen can switch from guidance to real operating momentum.',
      commandDeck,
      instrumentation,
      moduleReadiness,
      socialGrowthDirector: null,
      userActions,
      primaryAction: finalChecklist.find( item => item.status === 'needs_you' ) || finalChecklist[0],
      checklistItems: finalChecklist,
      blockers: [],
      outcomes,
      toddTried
    };
  }

  private shouldUseOnboardingPlan (
    contact: Contact | null,
    viewModel: DailyMomentumViewModel,
    engineState: ToddMomentumEngineState | null,
    calendarStatus: any = null,
    integrationState: DailyCommandIntegrationState
  ): boolean {
    if ( !this.hasCoreProfile( contact ) ) {
      return true;
    }

    const goalAmount = this.parseCurrencyAmount( viewModel.snapshot?.goalAmount );
    if ( goalAmount <= 0 ) {
      return true;
    }

    if ( viewModel.stripeConnectionNotice ) {
      return true;
    }

    if ( viewModel.calendarConnectionNotice && !this.hasHealthyCalendarConnection( engineState, calendarStatus ) ) {
      return true;
    }

    if ( !integrationState.hasProvisionedSender || !integrationState.hasConnectedSocialAccounts ) {
      return true;
    }

    return false;
  }

  private hasCoreProfile ( contact: Contact | null ): boolean {
    return !!String( contact?.firstName || '' ).trim()
      && !!String( contact?.lastName || '' ).trim()
      && !!String( contact?.company?.name || '' ).trim()
      && !!String( contact?.company?.description || '' ).trim()
      && !!String( contact?.jobDescriptionForTODD || '' ).trim();
  }

  private buildSetupItems (
    viewModel: DailyMomentumViewModel,
    engineState: ToddMomentumEngineState | null,
    calendarStatus: any = null,
    integrationState: DailyCommandIntegrationState
  ): DailyCommandItem[] {
    const items: DailyCommandItem[] = [];

    if ( viewModel.stripeConnectionNotice ) {
      items.push( {
        id: 'setup-stripe',
        title: 'Clear Stripe setup blocker',
        reason: viewModel.stripeConnectionNotice.message,
        route: '/daily-momentum',
        actionLabel: viewModel.stripeConnectionNotice.actionLabel || 'Open Daily Momentum',
        priority: 'medium',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval',
        autonomyNote: 'TODD cannot carry this path until the missing setup is cleared.',
        proof: this.joinProofItems( viewModel.stripeConnectionNotice.items )
      } );
    }

    if ( viewModel.calendarConnectionNotice && !this.hasHealthyCalendarConnection( engineState, calendarStatus ) ) {
      items.push( {
        id: 'setup-calendar',
        title: 'Reconnect calendar tracking',
        reason: viewModel.calendarConnectionNotice.message,
        route: '/daily-momentum?tab=operator',
        actionLabel: viewModel.calendarConnectionNotice.actionLabel || 'Open Daily Momentum',
        priority: 'medium',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval',
        autonomyNote: 'TODD needs meeting-tracking access before it can verify calendar outcomes on its own.',
        proof: this.joinProofItems( viewModel.calendarConnectionNotice.items )
      } );
    }

    const setupAction = ( viewModel.actionsTaken || [] ).find( action => action.state === 'setup_needed' );
    if ( setupAction ) {
      items.push( this.toChecklistItem(
        'setup-action',
        setupAction,
        'Clear execution setup',
        'setup',
        'high',
        'needs_you'
      ) );
    }

    const operatorAlertItem = ( engineState?.openAlerts || [] )
      .map( alert => this.toOperatorAlertChecklistItem( alert ) )
      .find( Boolean );

    if ( operatorAlertItem ) {
      items.push( operatorAlertItem );
    }

    if ( !integrationState.hasProvisionedSender ) {
      items.push( {
        id: 'setup-sender-gate',
        title: 'Finish outreach sender provisioning',
        reason: 'TODD should not claim outreach work until the sender is actually provisioned from Admin Control.',
        route: '/admin',
        actionLabel: 'Open Admin Control',
        priority: 'high',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval',
        autonomyNote: 'Outreach stays off until sender provisioning is complete.'
      } );
    }

    if ( !integrationState.hasConnectedSocialAccounts ) {
      items.push( {
        id: 'setup-social-gate',
        title: 'Connect a social account before enabling social momentum',
        reason: 'TODD should not draft or publish social work for a user with no connected social accounts.',
        route: '/outreach/social/accounts',
        actionLabel: 'Open Connected Accounts',
        priority: 'medium',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval',
        autonomyNote: 'Social stays off until at least one real account is connected.'
      } );
    }

    return items;
  }

  private buildApprovalItems ( viewModel: DailyMomentumViewModel, integrationState: DailyCommandIntegrationState ): DailyCommandItem[] {
    const items: DailyCommandItem[] = [];
    const approvalActions = viewModel.approvalChecklist?.actions || [];

    approvalActions.forEach( ( action, index ) => {
      const category = this.inferApprovalCategoryFromRoute( action.route );
      if ( ( category === 'social_drafting' || category === 'social_posting' ) && !integrationState.hasConnectedSocialAccounts ) {
        return;
      }
      if ( category === 'outreach_sending' && !integrationState.hasProvisionedSender ) {
        return;
      }
      items.push( this.fromApprovalAction( action, index ) );
    } );

    ( viewModel.actionsTaken || [] )
      .filter( action => action.state === 'waiting_for_approval' || action.state === 'approval_needed' )
      .forEach( ( action, index ) => {
        const category = this.inferApprovalCategoryFromAction( action );
        if ( ( category === 'social_drafting' || category === 'social_posting' ) && !integrationState.hasConnectedSocialAccounts ) {
          return;
        }
        if ( category === 'outreach_sending' && !integrationState.hasProvisionedSender ) {
          return;
        }
        items.push( this.toChecklistItem(
          `approval-action-${index}`,
          action,
          action.label || 'Approve prepared work',
          'approval',
          'high',
          'needs_you'
        ) );
      } );

    return items;
  }

  private buildHotSignalItems (
    viewModel: DailyMomentumViewModel,
    engineState: ToddMomentumEngineState | null,
    integrationState: DailyCommandIntegrationState
  ): DailyCommandItem[] {
    if ( !integrationState.hasProvisionedSender ) {
      return [];
    }

    const items: DailyCommandItem[] = [];
    const hotAction = ( viewModel.actionsTaken || [] ).find( action =>
      this.isHotSignalAction( action ) && !!action.route
    );

    if ( hotAction ) {
      items.push( this.toChecklistItem(
        'hot-signal-primary',
        hotAction,
        hotAction.label || 'Respond to warm signal',
        'signal',
        'high',
        hotAction.state === 'blocked' ? 'blocked' : 'ready'
      ) );
    }

    const alertDrivenSignal = ( engineState?.openAlerts || [] ).find( alert =>
      /click|reply|lead|intent|signal/i.test( `${alert?.message || ''} ${alert?.reason || ''}` )
    );

    if ( !hotAction && alertDrivenSignal ) {
      items.push( {
        id: 'hot-signal-alert',
        title: 'Review high-intent outreach signal',
        reason: String( alertDrivenSignal.message || alertDrivenSignal.reason || 'TODD found a live outreach signal that needs fast follow-up.' ).trim(),
        route: '/signal-engine',
        actionLabel: 'Open Outbox Cockpit',
        priority: 'high',
        status: 'ready',
        source: 'signal',
        autonomyLevel: 'auto',
        autonomyNote: 'TODD can keep watching this signal stream without waiting for you.',
        proof: String( alertDrivenSignal.recommendedFix || '' ).trim() || undefined
      } );
    }

    return items;
  }

  private buildCampaignGapItems (
    viewModel: DailyMomentumViewModel,
    socialQueueSummary: any,
    receiptsSummary: any,
    integrationState: DailyCommandIntegrationState
  ): DailyCommandItem[] {
    const items: DailyCommandItem[] = [];
    const resolvedGoal = this.parseCurrencyAmount( viewModel.snapshot?.goalAmount );
    if ( resolvedGoal <= 0 ) {
      return items;
    }

    const approvedCount = Number( socialQueueSummary?.approvedCount || 0 );
    const publishedThisWeekCount = Number( socialQueueSummary?.publishedThisWeekCount || 0 );
    const draftCount = Number( socialQueueSummary?.draftCount || 0 );
    const socialDraftingMode = this.getApprovalModeForCategory( viewModel, 'social_drafting' );
    const socialPostingMode = this.getApprovalModeForCategory( viewModel, 'social_posting' );
    const socialAutonomyLevel = socialPostingMode === 'auto' ? 'auto_after_timeout' : 'requires_approval';
    const behindGoal = viewModel.snapshot?.status === 'behind';
    const lowSocialCoverage = approvedCount === 0 && publishedThisWeekCount === 0;
    const noRecentExecution = Number( receiptsSummary?.executedCount || 0 ) <= 0;
    const senderReady = integrationState.hasProvisionedSender;
    const socialReady = integrationState.hasConnectedSocialAccounts;
    const campaignGapBlocker = ( viewModel.blockers || [] ).find( blocker =>
      /outreach|follow-up volume|campaign|lead coverage|meeting activity/i.test( String( blocker || '' ) )
    );

    if ( socialReady && draftCount > 0 ) {
      items.push( {
        id: 'social-drafts-review',
        title: `${draftCount} social draft${draftCount === 1 ? '' : 's'} prepared`,
        reason: socialPostingMode === 'auto'
          ? 'TODD already prepared the social work. Publishing is the only remaining gate between these drafts and autonomous momentum.'
          : 'TODD already prepared the social work. Your current policy is still making human approval the bottleneck before publishing.',
        route: '/outreach/social/calendar',
        actionLabel: socialPostingMode === 'auto' ? 'Review Drafts' : 'Review autonomy gate',
        priority: 'high',
        status: 'needs_you',
        source: 'approval',
        autonomyLevel: socialAutonomyLevel,
        autonomyNote: socialPostingMode === 'auto'
          ? 'Current policy: auto-after-timeout is the right next step, but draft approval is still manual today.'
          : `Current policy: ${socialDraftingMode === 'auto' ? 'drafting is automatic, but posting still waits for approval.' : 'drafting and posting still wait for approval.'}`,
        proof: `${draftCount} draft${draftCount === 1 ? '' : 's'} waiting`
      } );
    } else if ( socialReady && approvedCount > 0 ) {
      items.push( {
        id: 'social-publish-queue',
        title: `${approvedCount} approved social post${approvedCount === 1 ? '' : 's'} queued`,
        reason: socialPostingMode === 'auto'
          ? 'TODD has approved social work ready and should be carrying the publish step with minimal human friction.'
          : 'Approved visibility work is queued, but your current posting policy still puts a human gate in front of momentum.',
        route: '/outreach/social',
        actionLabel: 'Open Social Queue',
        priority: 'medium',
        status: 'ready',
        source: 'campaign_gap',
        autonomyLevel: socialAutonomyLevel,
        autonomyNote: socialPostingMode === 'auto'
          ? 'Current policy: auto. TODD should be allowed to carry the publish step once approval timing rules are satisfied.'
          : 'Current policy: requires approval before TODD can publish these posts.',
        proof: `${approvedCount} approved queue item${approvedCount === 1 ? '' : 's'}`
      } );
    }

    if ( senderReady && behindGoal && ( campaignGapBlocker || ( lowSocialCoverage && noRecentExecution ) ) ) {
      items.push( {
        id: 'campaign-gap-restart',
        title: 'Restart outreach momentum today',
        reason: String(
          campaignGapBlocker
          || 'TODD does not see enough recent campaign or follow-up activity to support today\'s goal.'
        ).trim(),
        route: '/outreach/app',
        actionLabel: 'Open Outreach',
        priority: 'medium',
        status: 'ready',
        source: 'campaign_gap',
        autonomyLevel: this.getApprovalModeForCategory( viewModel, 'outreach_sending' ) === 'auto' ? 'auto_after_timeout' : 'requires_approval',
        autonomyNote: this.getApprovalModeForCategory( viewModel, 'outreach_sending' ) === 'auto'
          ? 'Current policy says TODD should be carrying the send step, but the current engine still pauses at the final gate.'
          : 'Current policy still makes outreach sending wait for you.',
        proof: lowSocialCoverage ? 'No recent social coverage' : undefined
      } );
    }

    if ( behindGoal && !items.length && ( senderReady || socialReady ) ) {
      items.push( {
        id: 'goal-recovery-review',
        title: 'Review the strongest revenue recovery path',
        reason: 'Today\'s goal is still behind, so TODD wants the day anchored to the highest-confidence recovery lane.',
        route: '/daily-momentum',
        actionLabel: 'Open Daily Momentum',
        priority: 'medium',
        status: 'ready',
        source: 'goal_recovery',
        autonomyLevel: 'auto',
        autonomyNote: 'TODD can keep evaluating recovery paths even when no single manual action is selected yet.',
        proof: `${viewModel.snapshot.gapRemaining} gap remaining`
      } );
    }

    return items;
  }

  private buildSocialGrowthDirector (
    socialBootstrap: SocialBootstrapPayload | null,
    integrationState: DailyCommandIntegrationState
  ): DailyCommandSocialGrowthDirector | null {
    if ( !integrationState.hasConnectedSocialAccounts ) {
      return null;
    }

    const posts = Array.isArray( socialBootstrap?.posts ) ? socialBootstrap.posts : [];
    const activePost = this.selectSocialGrowthPost( posts );

    if ( !activePost ) {
      return this.buildSocialStrategyFallbackDirector( socialBootstrap, integrationState );
    }

    const growthState = activePost.growthState || {};
    const recoveryDraft = this.findRecoveryDraftForPost( activePost, posts );
    const pendingAction = ( Array.isArray( activePost.requiredActions ) ? activePost.requiredActions : [] )
      .find( action => String( action?.status || 'pending' ).toLowerCase() === 'pending' ) || null;
    const performance = activePost.postPerformance || {};
    const proofParts = [
      `Views ${Number( performance.views || 0 )}`,
      `Reach ${Number( performance.reach || 0 )}`,
      `Comments ${Number( activePost.engagementSignal?.comments || 0 )}`
    ];

    return {
      postId: String( activePost.postId || '' ).trim(),
      platformLabel: this.toPlatformLabel( activePost.platform || activePost.provider || 'social' ),
      status: this.resolveSocialGrowthDirectorStatus( activePost, recoveryDraft ),
      statusLabel: this.toSocialGrowthStatusLabel( this.resolveSocialGrowthDirectorStatus( activePost, recoveryDraft ) ),
      diagnosis: this.buildSocialGrowthDiagnosis( activePost, recoveryDraft ),
      toddNextMove: this.describeToddNextSocialMove( activePost, pendingAction, recoveryDraft ),
      userActionTitle: this.buildSocialGrowthUserActionTitle( activePost, pendingAction, recoveryDraft ),
      userActionInstruction: this.buildSocialGrowthUserActionInstruction( activePost, pendingAction, recoveryDraft ),
      userActionReason: this.buildSocialGrowthUserActionReason( activePost, pendingAction, recoveryDraft ),
      userActionLabel: this.buildSocialGrowthUserActionLabel( activePost, pendingAction, recoveryDraft ),
      route: this.buildSocialGrowthRoute( activePost, pendingAction, recoveryDraft ),
      nextCheckLabel: this.toNextCheckLabel( growthState.nextCheckAt ),
      proof: proofParts.join( ' · ' ),
      recoveryDraftPostId: String( recoveryDraft?.postId || '' ).trim() || null
    };
  }

  private buildSocialStrategyFallbackDirector (
    socialBootstrap: SocialBootstrapPayload | null,
    integrationState: DailyCommandIntegrationState
  ): DailyCommandSocialGrowthDirector | null {
    const strategy = socialBootstrap?.strategySummary || null;
    const posts = Array.isArray( socialBootstrap?.posts ) ? socialBootstrap.posts : [];
    const draftCount = posts.filter( post => String( post?.status || '' ).trim().toLowerCase() === 'draft' ).length;
    const approvedCount = posts.filter( post => String( post?.status || '' ).trim().toLowerCase() === 'approved' ).length;
    const providerLabel = this.resolveFallbackSocialPlatformLabel( socialBootstrap, integrationState, strategy );
    const nextMove = String(
      strategy?.nextBestAction
      || strategy?.nextBestSocialAction
      || strategy?.todayPostRequest
      || ''
    ).trim();
    const recommendedPostType = String( strategy?.recommendedNextPostType || strategy?.selectedContentCategory || 'operator insight' ).trim();
    const strategySummary = String(
      strategy?.reason
      || strategy?.strategySummary
      || strategy?.growthReason
      || ''
    ).trim();
    const cadenceLabel = this.toCadenceLabel( strategy?.cadence || strategy?.socialCadence || '' );
    const goalLabel = this.toStrategyGoalLabel( strategy?.goal || strategy?.activeMarketingGoal || strategy?.growthObjective || '' );
    const route = draftCount > 0
      ? '/outreach/social/calendar'
      : '/outreach/social/calendar';

    if ( !strategySummary && !nextMove && draftCount <= 0 && approvedCount <= 0 ) {
      return null;
    }

    return {
      postId: '',
      platformLabel: providerLabel,
      status: draftCount > 0 ? 'drafts_ready' : 'strategy_ready',
      statusLabel: draftCount > 0 ? 'Drafts ready' : 'Strategy ready',
      diagnosis: strategySummary || `TODD has enough ${providerLabel} context to choose the next growth move instead of leaving you with a blank page.`,
      toddNextMove: nextMove || `Prepare one ${recommendedPostType} for ${providerLabel} so TODD can turn the strategy into a real growth test today.`,
      userActionTitle: draftCount > 0
        ? `Review ${draftCount} prepared ${providerLabel} draft${draftCount === 1 ? '' : 's'}`
        : `Prepare today's ${providerLabel} ${recommendedPostType}`,
      userActionInstruction: draftCount > 0
        ? 'Open the prepared drafts, keep the strongest one, and approve it so TODD can carry the publishing step next.'
        : `Open Social Source and let TODD prepare the next ${providerLabel} post from the active growth strategy.`,
      userActionReason: draftCount > 0
        ? 'TODD already turned the strategy into drafts, so the only human step left is to choose the best one and let it move.'
        : strategySummary || `The current social strategy is aimed at ${goalLabel.toLowerCase()}, so TODD should turn it into one concrete post instead of leaving the plan abstract.`,
      userActionLabel: draftCount > 0 ? 'Review drafts' : 'Prepare post',
      route,
      nextCheckLabel: null,
      proof: this.compactProofParts( [
        goalLabel ? `Goal ${goalLabel}` : '',
        cadenceLabel ? `Cadence ${cadenceLabel}` : '',
        approvedCount > 0 ? `${approvedCount} approved` : '',
        draftCount > 0 ? `${draftCount} draft${draftCount === 1 ? '' : 's'}` : ''
      ] ),
      recoveryDraftPostId: null
    };
  }

  private buildOverdueMoveItems ( tasks: Task[], viewModel: DailyMomentumViewModel ): DailyCommandItem[] {
    const now = Date.now();
    const overdueTasks = tasks.filter( task => {
      if ( task.isCompleted || !task.dueDate ) return false;
      const dueTime = new Date( task.dueDate ).getTime();
      return Number.isFinite( dueTime ) && dueTime < now;
    } );

    if ( !overdueTasks.length ) {
      return [];
    }

    const highPressure = viewModel.snapshot?.status === 'behind';
    return [
      {
        id: 'overdue-moves',
        title: `Handle ${overdueTasks.length} overdue move${overdueTasks.length === 1 ? '' : 's'}`,
        reason: 'Open work is past due and can keep today\'s goal from turning into finished momentum.',
        route: '/tasks',
        actionLabel: 'Open Moves',
        priority: highPressure ? 'medium' : 'low',
        status: 'needs_you',
        source: 'overdue_move',
        autonomyLevel: 'requires_approval',
        autonomyNote: 'Moves still depend on explicit human handling unless TODD is allowed to execute them automatically.',
        proof: overdueTasks.slice( 0, 2 ).map( task => task.title ).filter( Boolean ).join( ' | ' ) || undefined
      }
    ];
  }

  private buildFallbackChecklist ( viewModel: DailyMomentumViewModel, integrationState: DailyCommandIntegrationState ): DailyCommandItem[] {
    const items: DailyCommandItem[] = [
      {
        id: 'fallback-daily-momentum',
        title: 'Review today\'s momentum picture',
        reason: 'TODD did not find a single dominant interruption, so start with the current momentum board and pressure summary.',
        route: '/daily-momentum',
        actionLabel: 'Open Daily Momentum',
        priority: 'medium',
        status: 'ready',
        source: 'fallback',
        autonomyLevel: 'auto',
        autonomyNote: 'TODD is still evaluating the strongest route without waiting for a manual trigger.',
        proof: viewModel.snapshot?.statusLabel || undefined
      }
    ];

    if ( integrationState.hasProvisionedSender ) {
      items.push( {
        id: 'fallback-outreach',
        title: 'Check outreach readiness',
        reason: 'A quick review of active outreach keeps the day from drifting while TODD keeps watching for stronger signals.',
        route: '/signal-engine',
        actionLabel: 'Open Outbox Cockpit',
        priority: 'low',
        status: 'ready',
        source: 'fallback',
        autonomyLevel: 'auto',
        autonomyNote: 'TODD can keep watching outreach readiness and queued work in the background.'
      } );
    } else {
      items.push( {
        id: 'fallback-sender-setup',
        title: 'Finish sending setup before using Outreach',
        reason: 'Outreach work should stay off until your sender has been provisioned.',
        route: '/admin',
        actionLabel: 'Open Admin Control',
        priority: 'low',
        status: 'needs_you',
        source: 'fallback',
        autonomyLevel: 'requires_approval',
        autonomyNote: 'TODD is holding outreach claims until sending is really ready.'
      } );
    }

    return items;
  }

  private buildGoalHeadline ( viewModel: DailyMomentumViewModel ): string {
    const numericGoal = this.parseCurrencyAmount( viewModel.snapshot?.goalAmount );
    if ( numericGoal <= 0 ) {
      return 'New users start at zero here until revenue, calendar, and execution systems are actually connected.';
    }

    const goal = viewModel.snapshot?.goalAmount || '$0';
    const revenue = viewModel.snapshot?.revenueSoFar || '$0';
    const gap = viewModel.snapshot?.gapRemaining || '$0';
    const status = viewModel.snapshot?.status || 'unknown';

    if ( status === 'met' ) {
      return `Today's goal of ${goal} is covered. TODD is protecting momentum and setting up tomorrow.`;
    }

    if ( status === 'on_track' ) {
      return `Today's goal is ${goal}. Revenue is at ${revenue}, and TODD says the day is on track.`;
    }

    if ( status === 'behind' ) {
      return `Today's goal is ${goal}. Revenue is at ${revenue}, with ${gap} still to recover.`;
    }

    return `Today's goal is ${goal}. TODD is still validating the current pressure and best path forward.`;
  }

  private buildTodaySummary ( viewModel: DailyMomentumViewModel, engineState: ToddMomentumEngineState | null, checklist: DailyCommandItem[], outcomes: DailyCommandOutcome[] ): string {
    const numericGoal = this.parseCurrencyAmount( viewModel.snapshot?.goalAmount );
    if ( numericGoal <= 0 ) {
      return 'TODD is still in setup mode here: connect the real systems first, then Today can switch from orientation to truthful operating momentum.';
    }

    const topAction = checklist[0];
    const accountability = viewModel.accountabilityMessage?.summary || '';
    const engineSummary = String( engineState?.currentSummary || '' ).trim();
    const approvalBlocked = checklist.filter( item => item.autonomyLevel === 'requires_approval' && item.status === 'needs_you' ).length;
    const autonomousMoves = checklist.filter( item => item.autonomyLevel !== 'requires_approval' && item.status !== 'blocked' ).length;
    const outcomeSummary = outcomes.length
      ? `${outcomes.length} business outcome${outcomes.length === 1 ? '' : 's'} already moved today.`
      : '';
    const autonomySummary = approvalBlocked > 0
      ? `${approvalBlocked} step${approvalBlocked === 1 ? '' : 's'} are still being held at an approval gate.`
      : autonomousMoves > 0
        ? `${autonomousMoves} move${autonomousMoves === 1 ? '' : 's'} can keep running without waiting on you.`
        : '';

    return [outcomeSummary, autonomySummary, accountability
      || engineSummary
      || topAction?.reason
      || 'TODD is watching the day, ranking the work, and keeping the next move visible.']
      .filter( Boolean )
      .join( ' ' );
  }

  private buildOutcomes (
    viewModel: DailyMomentumViewModel,
    engineState: ToddMomentumEngineState | null,
    receiptsFeed: Array<any>,
    socialQueueSummary: any,
    integrationState: DailyCommandIntegrationState
  ): DailyCommandOutcome[] {
    const outcomes: DailyCommandOutcome[] = [];
    const resolvedGoal = this.parseCurrencyAmount( viewModel.snapshot?.goalAmount );
    if ( resolvedGoal <= 0 ) {
      return outcomes;
    }

    const emailsSent = Number( engineState?.channelOutcomes?.outbox?.sentCount || 0 );
    const socialPublished = Number(
      engineState?.channelOutcomes?.social?.publishedCount
      || engineState?.latestOperatorReport?.socialPostsPublished
      || engineState?.socialQueueTelemetry?.publishedCount
      || 0
    );
    const successfulActions = ( viewModel.actionsTaken || [] )
      .filter( action => ['completed', 'auto_executed'].includes( String( action?.state || '' ) ) ).length;
    const appointments = this.parseCountValue( viewModel.snapshot?.appointmentMetricValue );
    const queuedSocial = Number( socialQueueSummary?.approvedCount || 0 );

    if ( integrationState.hasProvisionedSender && emailsSent > 0 ) {
      outcomes.push( {
        id: 'outcome-emails-sent',
        label: 'Follow-ups sent',
        value: String( emailsSent ),
        detail: 'TODD already pushed live outreach instead of leaving the day in review mode.',
        tone: 'positive'
      } );
    }

    if ( integrationState.hasConnectedSocialAccounts && socialPublished > 0 ) {
      outcomes.push( {
        id: 'outcome-social-published',
        label: 'Social posts published',
        value: String( socialPublished ),
        detail: this.buildSocialPublishedSummary( socialPublished, receiptsFeed ),
        tone: 'positive'
      } );
    }

    if ( appointments > 0 ) {
      outcomes.push( {
        id: 'outcome-meetings-booked',
        label: 'Meetings booked',
        value: String( appointments ),
        detail: 'Calendar-backed appointment activity is already contributing to today’s momentum.',
        tone: 'positive'
      } );
    }

    if ( successfulActions > 0 ) {
      outcomes.push( {
        id: 'outcome-actions-executed',
        label: 'Momentum moves executed',
        value: String( successfulActions ),
        detail: 'TODD already carried finished execution steps instead of only recommending work.',
        tone: 'positive'
      } );
    }

    if ( integrationState.hasConnectedSocialAccounts && queuedSocial > 0 && outcomes.length < 4 ) {
      outcomes.push( {
        id: 'outcome-social-queued',
        label: 'Social posts queued',
        value: String( queuedSocial ),
        detail: 'Prepared visibility work is already in position instead of being brainstormed from scratch.',
        tone: 'attention'
      } );
    }

    return outcomes.slice( 0, 4 );
  }

  private buildToddTried (
    viewModel: DailyMomentumViewModel,
    engineState: ToddMomentumEngineState | null,
    receiptsFeed: Array<any>,
    calendarStatus: any = null,
    integrationState: DailyCommandIntegrationState
  ): DailyCommandEvidence[] {
    const resolvedGoal = this.parseCurrencyAmount( viewModel.snapshot?.goalAmount );
    const activitySummaryEvidence = this.buildActivitySummaryEvidence( engineState, receiptsFeed, integrationState );
    const calendarConnected = this.isCalendarConnected( calendarStatus );
    const auditEvidence = ( viewModel.auditTrail || [] )
      .filter( item => !this.shouldSuppressAuditItem( item, resolvedGoal, calendarConnected, integrationState ) )
      .slice( 0, 4 )
      .map( ( item, index ) => {
        const evidence = this.auditItemToEvidence( item, index );
        if ( evidence.label === 'Calendar checked' && calendarConnected ) {
          return {
            ...evidence,
            summary: this.buildConnectedCalendarSummary( calendarStatus ),
            tone: 'positive' as const
          };
        }
        return evidence;
      } );

    const receiptEvidence = receiptsFeed
      .slice( 0, 3 )
      .map( ( item: any, index: number ) => ( {
        id: `receipt-${index}`,
        label: String( item?.title || item?.type || 'Momentum receipt' ).trim(),
        summary: String( item?.summary || item?.detail || item?.status || 'TODD recorded execution activity.' ).trim(),
        tone: this.mapReceiptTone( String( item?.tone || item?.status || '' ) ),
        route: String( item?.route || '' ).trim() || undefined
      } ) );

    const engineEvidence = engineState?.currentSummary
      ? [{
        id: 'engine-state',
        label: `Engine: ${engineState.runState || 'watching'}`,
        summary: String( engineState.currentSummary ).trim(),
        tone: this.mapEngineEvidenceTone( String( engineState.runState || '' ) )
      }]
      : [];

    return [
      ...( activitySummaryEvidence ? [activitySummaryEvidence] : [] ),
      ...engineEvidence,
      ...auditEvidence,
      ...receiptEvidence
    ].slice( 0, 6 );
  }

  private buildActivitySummaryEvidence (
    engineState: ToddMomentumEngineState | null,
    receiptsFeed: Array<any>,
    integrationState: DailyCommandIntegrationState
  ): DailyCommandEvidence | null {
    const emailsSent = Number( engineState?.channelOutcomes?.outbox?.sentCount || 0 );
    const socialPublished = Number(
      engineState?.channelOutcomes?.social?.publishedCount
      || engineState?.latestOperatorReport?.socialPostsPublished
      || engineState?.socialQueueTelemetry?.publishedCount
      || 0
    );

    const safeEmailsSent = integrationState.hasProvisionedSender ? emailsSent : 0;
    const safeSocialPublished = integrationState.hasConnectedSocialAccounts ? socialPublished : 0;

    if ( safeEmailsSent <= 0 && safeSocialPublished <= 0 ) {
      return null;
    }

    const summaryParts: string[] = [];
    if ( integrationState.hasProvisionedSender ) {
      summaryParts.push( `Emails sent today: ${safeEmailsSent}.` );
    }
    if ( integrationState.hasConnectedSocialAccounts ) {
      summaryParts.push( this.buildSocialPublishedSummary( safeSocialPublished, receiptsFeed ) );
    }

    return {
      id: 'activity-summary',
      label: 'Today so far',
      summary: summaryParts.join( ' ' ).trim(),
      tone: safeEmailsSent > 0 || safeSocialPublished > 0 ? 'positive' : 'info'
    };
  }

  private buildSocialPublishedSummary ( socialPublished: number, receiptsFeed: Array<any> ): string {
    const platformLabels = this.inferPublishedSocialPlatforms( receiptsFeed );

    if ( socialPublished <= 0 ) {
      return 'Social posts published today: 0.';
    }

    if ( !platformLabels.length ) {
      return `Social posts published today: ${socialPublished}.`;
    }

    return `Social posts published today: ${socialPublished} on ${this.joinWithAnd( platformLabels )}.`;
  }

  private buildCommandDeck (
    mode: DailyCommandPlan['mode'],
    viewModel: DailyMomentumViewModel,
    checklistItems: DailyCommandItem[],
    moduleReadiness: DailyCommandModuleReadiness[]
  ): DailyCommandDeck {
    const readyCount = moduleReadiness.filter( module => module.state === 'ready' ).length;
    const blockedCount = moduleReadiness.filter( module => module.state === 'blocked' ).length;
    const attentionCount = moduleReadiness.filter( module => module.state === 'attention' ).length;
    const approvals = checklistItems.filter( item => item.autonomyLevel === 'requires_approval' && item.status === 'needs_you' ).length;
    const numericGoal = this.parseCurrencyAmount( viewModel.snapshot?.goalAmount );
    const title = mode === 'onboarding' ? 'Today cockpit' : 'TODD operating cockpit';
    const subtitle = mode === 'onboarding'
      ? 'TODD is still earning autonomy. These instruments show which systems are ready, which ones are waiting on setup, and what to unlock next.'
      : 'TODD is monitoring the six momentum systems, surfacing what is healthy, and calling out the few human actions that still slow the day down.';
    const modeLabel = mode === 'onboarding'
      ? 'Setup'
      : blockedCount > 0
        ? 'Limited'
        : attentionCount > 0 || approvals > 0
          ? 'Guarded'
          : 'Operational';

    return {
      eyebrow: 'TODD Command Deck',
      title,
      subtitle,
      modeLabel,
      scoreLabel: 'Autonomy',
      scoreValue: mode === 'onboarding' && numericGoal <= 0 && readyCount === 0
        ? '0%'
        : `${Math.round( ( readyCount / Math.max( moduleReadiness.length, 1 ) ) * 100 )}%`
    };
  }

  private buildInstrumentation (
    mode: DailyCommandPlan['mode'],
    moduleReadiness: DailyCommandModuleReadiness[],
    checklistItems: DailyCommandItem[],
    outcomes: DailyCommandOutcome[]
  ): DailyCommandInstrumentation {
    const readyCount = moduleReadiness.filter( module => module.state === 'ready' ).length;
    const attentionCount = moduleReadiness.filter( module => module.state === 'attention' ).length;
    const blockedCount = moduleReadiness.filter( module => module.state === 'blocked' ).length;
    const approvalCount = checklistItems.filter( item => item.autonomyLevel === 'requires_approval' && item.status === 'needs_you' ).length;
    const activeOutcomeCount = outcomes.filter( outcome => outcome.tone === 'positive' ).length;

    return {
      readinessPercent: Math.round( ( readyCount / Math.max( moduleReadiness.length, 1 ) ) * 100 ),
      modeLabel: mode === 'onboarding' ? 'Setup mode' : blockedCount > 0 ? 'Autonomy constrained' : 'Operating lane',
      modeDetail: mode === 'onboarding'
        ? 'TODD is still waiting for real systems and permissions before it should make stronger operating claims.'
        : blockedCount > 0
          ? 'One or more systems are blocked, so TODD is holding back claims until those dependencies are real.'
          : attentionCount > 0 || approvalCount > 0
            ? 'Most systems are live, but a few attention points are still limiting autonomy.'
            : 'All six systems are in a healthy operating state right now.',
      lights: [
        {
          id: 'systems-ready',
          label: 'Green',
          value: String( readyCount ),
          detail: readyCount === 1 ? 'system ready' : 'systems ready',
          tone: 'positive',
          pulse: readyCount > 0
        },
        {
          id: 'needs-attention',
          label: 'Orange',
          value: String( attentionCount ),
          detail: attentionCount === 1 ? 'system needs attention' : 'systems need attention',
          tone: 'attention',
          pulse: attentionCount > 0
        },
        {
          id: 'blocked',
          label: 'Red',
          value: String( blockedCount ),
          detail: blockedCount === 1 ? 'system blocked' : 'systems blocked',
          tone: 'warn',
          pulse: blockedCount > 0
        },
        {
          id: 'human-gates',
          label: 'Human gates',
          value: String( approvalCount ),
          detail: approvalCount === 1 ? 'approval still pending' : 'approvals still pending',
          tone: approvalCount > 0 ? 'info' : 'positive',
          pulse: approvalCount > 0 || activeOutcomeCount > 0
        }
      ]
    };
  }

  private buildModuleReadiness (
    mode: DailyCommandPlan['mode'],
    checklistItems: DailyCommandItem[],
    blockers: DailyCommandItem[],
    outcomes: DailyCommandOutcome[],
    viewModel: DailyMomentumViewModel,
    engineState: ToddMomentumEngineState | null,
    contact: Contact | null,
    calendarStatus: any,
    tasks: Task[],
    integrationState: DailyCommandIntegrationState
  ): DailyCommandModuleReadiness[] {
    const overdueTaskCount = tasks.filter( task => {
      if ( task.isCompleted || !task.dueDate ) return false;
      const dueTime = new Date( task.dueDate ).getTime();
      return Number.isFinite( dueTime ) && dueTime < Date.now();
    } ).length;
    const hasProfile = this.hasCoreProfile( contact );
    const hasNetworkAction = checklistItems.some( item => item.module === 'network' );
    const hasDocsAction = checklistItems.some( item => item.module === 'docs' );
    const hasPulseAlert = ( engineState?.openAlerts || [] ).some( alert =>
      /feedback|survey|signal/.test( `${alert?.area || ''} ${alert?.message || ''} ${alert?.reason || ''}`.toLowerCase() )
    );

    return [
      this.createModuleReadiness( {
        key: 'network',
        label: 'Network',
        state: mode === 'onboarding' && hasNetworkAction ? 'attention' : 'ready',
        detail: mode === 'onboarding' && hasNetworkAction
          ? 'TODD still needs real contacts or coverage before Network can become a dependable operating lane.'
          : 'Network has enough truth for TODD to reason about people coverage without pretending more than it knows.',
        route: '/contact-list',
        progressPercent: mode === 'onboarding' && hasNetworkAction ? 45 : 100,
        progressLabel: mode === 'onboarding' && hasNetworkAction ? 'Contacts still needed' : 'Network ready',
        proof: hasNetworkAction
          ? checklistItems.find( item => item.module === 'network' )?.reason
          : 'No active Network blocker detected.',
        userActionCount: checklistItems.filter( item => item.module === 'network' ).length
      } ),
      this.createModuleReadiness( {
        key: 'outreach',
        label: 'Outreach',
        state: !integrationState.hasProvisionedSender
          ? 'blocked'
          : checklistItems.some( item => item.module === 'outreach' && item.status !== 'ready' )
            ? 'attention'
            : 'ready',
        detail: !integrationState.hasProvisionedSender
          ? 'Sender provisioning is still missing, so TODD should not claim email execution or reply handling yet.'
          : checklistItems.some( item => item.module === 'outreach' && item.status !== 'ready' )
            ? 'Outreach can operate, but approvals or live follow-up pressure still need a human decision.'
            : 'Sender provisioning is healthy and no live outreach blocker is stopping autonomy right now.',
        route: '/signal-engine',
        progressPercent: !integrationState.hasProvisionedSender ? 20 : checklistItems.some( item => item.module === 'outreach' && item.status !== 'ready' ) ? 65 : 100,
        progressLabel: !integrationState.hasProvisionedSender ? 'Provision sender' : checklistItems.some( item => item.module === 'outreach' && item.status !== 'ready' ) ? 'Needs review' : 'Outreach ready',
        proof: !integrationState.hasProvisionedSender
          ? 'Outreach sender provisioning not ready.'
          : checklistItems.find( item => item.module === 'outreach' )?.reason || 'No live outreach blocker detected.',
        userActionCount: checklistItems.filter( item => item.module === 'outreach' ).length
      } ),
      this.createModuleReadiness( {
        key: 'social',
        label: 'Social',
        state: !integrationState.hasConnectedSocialAccounts
          ? 'blocked'
          : checklistItems.some( item => item.module === 'social' && item.status !== 'ready' )
            ? 'attention'
            : 'ready',
        detail: !integrationState.hasConnectedSocialAccounts
          ? 'No real social account is connected, so TODD should stay quiet about social drafts, queueing, or publishing.'
          : checklistItems.some( item => item.module === 'social' && item.status !== 'ready' )
            ? 'Social accounts are live, but human review is still the main bottleneck before momentum can carry forward.'
            : 'At least one real social account is healthy, so TODD can truthfully monitor social momentum.',
        route: '/outreach/social/accounts',
        progressPercent: !integrationState.hasConnectedSocialAccounts ? 15 : checklistItems.some( item => item.module === 'social' && item.status !== 'ready' ) ? 60 : 100,
        progressLabel: !integrationState.hasConnectedSocialAccounts ? 'Connect account' : checklistItems.some( item => item.module === 'social' && item.status !== 'ready' ) ? 'Approval gated' : 'Social ready',
        proof: !integrationState.hasConnectedSocialAccounts
          ? 'Connected social account required.'
          : checklistItems.find( item => item.module === 'social' )?.reason || 'No active social blocker detected.',
        userActionCount: checklistItems.filter( item => item.module === 'social' ).length
      } ),
      this.createModuleReadiness( {
        key: 'moves',
        label: 'Moves',
        state: overdueTaskCount > 0 ? 'attention' : 'ready',
        detail: overdueTaskCount > 0
          ? 'Open moves are overdue, so TODD still needs you to close or reschedule the human work it cannot silently finish.'
          : 'No overdue moves are dragging momentum right now.',
        route: '/tasks',
        progressPercent: overdueTaskCount > 0 ? 58 : 100,
        progressLabel: overdueTaskCount > 0 ? 'Overdue moves' : 'Moves ready',
        proof: overdueTaskCount > 0
          ? `${overdueTaskCount} overdue move${overdueTaskCount === 1 ? '' : 's'}`
          : 'No overdue move blocker detected.',
        userActionCount: checklistItems.filter( item => item.module === 'moves' ).length
      } ),
      this.createModuleReadiness( {
        key: 'docs',
        label: 'Docs',
        state: hasProfile
          ? hasDocsAction ? 'attention' : 'ready'
          : 'blocked',
        detail: !hasProfile
          ? 'Without real business context, TODD has nowhere trustworthy to anchor operating notes and document reasoning.'
          : hasDocsAction
            ? 'A docs-related action still needs attention before TODD can treat this context as fully current.'
            : 'No document blocker is limiting autonomy right now.',
        route: '/docs',
        progressPercent: !hasProfile ? 25 : hasDocsAction ? 65 : 100,
        progressLabel: !hasProfile ? 'Context needed' : hasDocsAction ? 'Needs review' : 'Docs ready',
        proof: hasDocsAction
          ? checklistItems.find( item => item.module === 'docs' )?.reason
          : 'No docs blocker detected in the current plan.',
        userActionCount: checklistItems.filter( item => item.module === 'docs' ).length
      } ),
      this.createModuleReadiness( {
        key: 'pulse',
        label: 'Pulse',
        state: this.getPulseReadiness( integrationState.surveys, hasPulseAlert ).state,
        detail: this.getPulseReadiness( integrationState.surveys, hasPulseAlert ).detail,
        route: '/daily-momentum',
        progressPercent: this.getPulseReadiness( integrationState.surveys, hasPulseAlert ).progressPercent,
        progressLabel: this.getPulseReadiness( integrationState.surveys, hasPulseAlert ).progressLabel,
        proof: this.getPulseReadiness( integrationState.surveys, hasPulseAlert ).proof
          || blockers.find( item => item.module === 'pulse' )?.reason
          || 'No pulse blocker detected.',
        userActionCount: checklistItems.filter( item => item.module === 'pulse' ).length
      } )
    ];
  }

  private getPulseReadiness (
    surveys: Survey[] | null,
    hasPulseAlert: boolean
  ): { state: DailyCommandModuleState; detail: string; progressPercent: number; progressLabel: string; proof: string; } {
    if ( surveys === null ) {
      return {
        state: 'attention',
        detail: 'Pulse survey activity could not be verified right now.',
        progressPercent: 50,
        progressLabel: 'Activity unavailable',
        proof: 'Survey activity check unavailable.'
      };
    }

    const now = Date.now();
    const recentCutoff = now - 30 * 24 * 60 * 60 * 1000;
    const publishedSurveys = surveys.filter( survey => survey.status === 'published' );
    const recentPublishedSurveys = publishedSurveys.filter( survey => {
      const publishedAt = Date.parse( String( survey.publishedAt || survey.updatedAt || survey.lastUpdated || '' ) );
      return Number.isFinite( publishedAt ) && publishedAt >= recentCutoff;
    } );
    const recentResponses = publishedSurveys.some( survey => Number( survey.responseCount || 0 ) > 0 );

    if ( recentPublishedSurveys.length === 0 ) {
      return {
        state: 'blocked',
        detail: publishedSurveys.length > 0
          ? 'Pulse is blocked because no survey has been sent or published in the last 30 days.'
          : 'Pulse is blocked until a survey is published and sent to customers.',
        progressPercent: 20,
        progressLabel: 'Send a recent survey',
        proof: publishedSurveys.length > 0 ? 'No recent survey activity' : 'No published survey found'
      };
    }

    if ( hasPulseAlert || !recentResponses ) {
      return {
        state: 'attention',
        detail: !recentResponses
          ? 'Pulse is live, but recent survey responses have not arrived yet.'
          : 'Pulse is live, but customer-signal review still needs attention.',
        progressPercent: 62,
        progressLabel: !recentResponses ? 'Waiting for responses' : 'Signal needs review',
        proof: !recentResponses ? 'Recent survey sent; no responses yet' : 'Recent survey activity detected'
      };
    }

    return {
      state: 'ready',
      detail: 'Pulse has recent survey activity and response signal available for TODD to use.',
      progressPercent: 100,
      progressLabel: 'Pulse ready',
      proof: 'Recent survey activity and responses detected'
    };
  }

  private createModuleReadiness ( config: Omit<DailyCommandModuleReadiness, 'stateLabel' | 'indicatorTone'> ): DailyCommandModuleReadiness {
    const stateLabel = config.state === 'ready'
      ? 'Ready'
      : config.state === 'attention'
        ? 'Needs attention'
        : 'Blocked';
    const indicatorTone: DailyCommandEvidence['tone'] = config.state === 'ready'
      ? 'positive'
      : config.state === 'attention'
        ? 'attention'
        : 'warn';

    return {
      ...config,
      stateLabel,
      indicatorTone
    };
  }

  private buildUserActions ( checklistItems: DailyCommandItem[] ): DailyCommandItem[] {
    const ranked = this.rankChecklist( checklistItems.filter( item =>
      item.status !== 'ready' || item.autonomyLevel === 'requires_approval'
    ) );

    return ranked.slice( 0, 8 );
  }

  private attachModules ( items: DailyCommandItem[] ): DailyCommandItem[] {
    return items.map( item => ( {
      ...item,
      module: item.module || this.inferModuleForItem( item )
    } ) );
  }

  private inferModuleForItem ( item: DailyCommandItem ): DailyCommandModuleKey {
    const route = String( item.route || '' ).toLowerCase();
    const raw = `${item.title || ''} ${item.reason || ''} ${item.actionLabel || ''} ${item.proof || ''}`.toLowerCase();

    if ( route.startsWith( '/contact' ) || route.startsWith( '/network' ) || /contact|network|csv|lead vault/.test( raw ) ) {
      return 'network';
    }

    if ( route.startsWith( '/outreach/social' ) || /linkedin|threads|bluesky|facebook|instagram|youtube|social/.test( raw ) ) {
      return 'social';
    }

    if ( route.startsWith( '/outbox' ) || route.startsWith( '/outreach/app' ) || route.startsWith( '/inbox-access' ) || /sender|outreach|follow-up|mailbox|email/.test( raw ) ) {
      return 'outreach';
    }

    if ( route.startsWith( '/tasks' ) || /move|task|approval gate/.test( raw ) ) {
      return 'moves';
    }

    if ( route.startsWith( '/docs' ) || /document|doc /.test( raw ) ) {
      return 'docs';
    }

    return 'pulse';
  }

  private inferPublishedSocialPlatforms ( receiptsFeed: Array<any> ): string[] {
    const platforms = new Set<string>();

    ( Array.isArray( receiptsFeed ) ? receiptsFeed : [] ).forEach( item => {
      const title = String( item?.title || item?.summary || '' ).trim();
      const detail = String( item?.detail || '' ).trim();
      const combined = `${title} ${detail}`.trim();
      const match = combined.match( /published a[n]?\s+(.+?)\s+post/i );

      if ( !match ) {
        return;
      }

      const label = this.toPlatformLabel( match[1] );
      if ( label ) {
        platforms.add( label );
      }
    } );

    return Array.from( platforms );
  }

  private toPlatformLabel ( raw: string ): string {
    const normalized = String( raw || '' ).trim().toLowerCase().replace( /[_-]+/g, ' ' );
    const compact = normalized.replace( /\s+/g, ' ' );

    if ( compact === 'linkedin' ) return 'LinkedIn';
    if ( compact === 'youtube' ) return 'YouTube';
    if ( compact === 'google business profile' ) return 'Google Business Profile';

    return compact
      .split( ' ' )
      .filter( Boolean )
      .map( part => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
      .join( ' ' );
  }

  private joinWithAnd ( items: string[] ): string {
    const parts = Array.isArray( items ) ? items.filter( Boolean ) : [];
    if ( parts.length <= 1 ) return parts[0] || '';
    if ( parts.length === 2 ) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice( 0, -1 ).join( ', ' )}, and ${parts[parts.length - 1]}`;
  }

  private rankChecklist ( items: DailyCommandItem[] ): DailyCommandItem[] {
    const priorityScore: Record<DailyCommandPriority, number> = {
      high: 300,
      medium: 200,
      low: 100
    };
    const statusScore: Record<DailyCommandStatus, number> = {
      needs_you: 80,
      ready: 70,
      waiting: 40,
      blocked: 20
    };
    const sourceScore: Record<DailyCommandSource, number> = {
      setup: 70,
      attention: 68,
      approval: 65,
      signal: 60,
      campaign_gap: 50,
      overdue_move: 40,
      goal_recovery: 35,
      fallback: 10
    };

    return [...items].sort( ( a, b ) => {
      const aScore = priorityScore[a.priority] + statusScore[a.status] + sourceScore[a.source];
      const bScore = priorityScore[b.priority] + statusScore[b.status] + sourceScore[b.source];
      return bScore - aScore;
    } );
  }

  private selectPrimaryAction ( items: DailyCommandItem[] ): DailyCommandItem | null {
    if ( !items.length ) {
      return null;
    }

    return items.find( item => item.status === 'needs_you' || item.status === 'ready' ) || items[0];
  }

  private deduplicateItems ( items: DailyCommandItem[] ): DailyCommandItem[] {
    const byRouteAndTitle = new Map<string, DailyCommandItem>();

    items.forEach( item => {
      const key = `${item.route}::${item.title}`.toLowerCase();
      const existing = byRouteAndTitle.get( key );

      if ( !existing ) {
        byRouteAndTitle.set( key, item );
        return;
      }

      if ( this.comparePriority( item.priority, existing.priority ) > 0 ) {
        byRouteAndTitle.set( key, item );
      }
    } );

    return Array.from( byRouteAndTitle.values() );
  }

  private comparePriority ( a: DailyCommandPriority, b: DailyCommandPriority ): number {
    const score: Record<DailyCommandPriority, number> = { high: 3, medium: 2, low: 1 };
    return score[a] - score[b];
  }

  private fromApprovalAction ( action: DailyMomentumApprovalAction, index: number ): DailyCommandItem {
    const category = this.inferApprovalCategoryFromRoute( action.route );
    return {
      id: `approval-checklist-${index}`,
      title: this.buildApprovalOutcomeTitle( action ),
      reason: this.buildApprovalOutcomeReason( action, category ),
      route: action.route || '/daily-momentum',
      actionLabel: category === 'outreach_sending' || category === 'social_posting'
        ? 'Review autonomy gate'
        : this.toRouteActionLabel( action.route, 'Review now' ),
      priority: action.risk === 'high' ? 'high' : 'medium',
      status: 'needs_you',
      source: 'approval',
      autonomyLevel: 'requires_approval',
      autonomyNote: this.buildApprovalAutonomyNote( category ),
      proof: action.missingApproval || undefined
    };
  }

  private toChecklistItem (
    prefix: string,
    action: DailyMomentumActionRow,
    fallbackTitle: string,
    source: DailyCommandSource,
    priority: DailyCommandPriority,
    status: DailyCommandStatus
  ): DailyCommandItem {
    return {
      id: `${prefix}-${action.actionPlanId || action.actionType || action.label || 'item'}`.toLowerCase().replace( /[^a-z0-9-]+/g, '-' ),
      title: action.label || fallbackTitle,
      reason: action.approvalSummary || action.preparedSummary || action.detail || 'TODD prepared the next move here.',
      route: action.route || '/daily-momentum',
      actionLabel: action.approvalLabel || action.reviewLabel || this.toRouteActionLabel( action.route, 'Open now' ),
      priority,
      status,
      source,
      autonomyLevel: this.resolveAutonomyLevelForAction( action, source ),
      autonomyNote: this.buildActionAutonomyNote( action, source ),
      proof: this.metricsToProof( action.metrics ) || action.behaviorCommandSummary || undefined
    };
  }

  private isHotSignalAction ( action: DailyMomentumActionRow ): boolean {
    const raw = `${action.label || ''} ${action.detail || ''} ${action.preparedSummary || ''} ${action.approvalSummary || ''} ${action.route || ''}`.toLowerCase();
    return /click|reply|high intent|hot|signal|outbox|open the thread|warm/.test( raw );
  }

  private hasHealthyCalendarConnection ( engineState: ToddMomentumEngineState | null, calendarStatus: any = null ): boolean {
    if ( this.isCalendarConnected( calendarStatus ) ) {
      return true;
    }

    if ( !engineState ) {
      return false;
    }

    const hasCalendarAlert = ( engineState.openAlerts || [] ).some( alert =>
      /calendar/.test( `${alert?.area || ''} ${alert?.message || ''} ${alert?.reason || ''}`.toLowerCase() )
    );

    if ( hasCalendarAlert ) {
      return false;
    }

    const integrationsWorking = Array.isArray( engineState.latestOperatorReport?.integrationsWorking )
      ? engineState.latestOperatorReport?.integrationsWorking
      : [];
    const hasCalendarIntegration = integrationsWorking.some( item => /calendar/.test( String( item || '' ).toLowerCase() ) );

    return hasCalendarIntegration || Boolean( engineState.lastCalendarCheckAt );
  }

  private isCalendarConnected ( calendarStatus: any = null ): boolean {
    return !!calendarStatus?.calendarConnected;
  }

  private buildConnectedCalendarSummary ( calendarStatus: any = null ): string {
    const provider = String( calendarStatus?.provider || '' ).trim().toLowerCase();
    const hasPermissions = calendarStatus?.hasPermissions !== false;
    const providerLabel = provider ? ` (${provider})` : '';

    if ( hasPermissions ) {
      return `Calendar connected${providerLabel} — meeting tracking available.`;
    }

    return `Calendar connected${providerLabel}, but TODD still needs calendar read access to track meetings.`;
  }

  private toOperatorAlertChecklistItem ( alert: MomentumOpenAlert | undefined ): DailyCommandItem | null {
    if ( !alert ) {
      return null;
    }

    if ( this.isTemporaryMomentumDelayAlert( alert ) ) {
      return {
        id: 'attention-temporary-momentum-delay',
        title: 'Temporary system delay',
        reason: 'TODD hit a temporary delay while checking today\'s momentum. Wait a minute, then check again.',
        route: '/daily-momentum',
        actionLabel: 'Open Daily Momentum',
        priority: 'high',
        status: 'needs_you',
        source: 'attention',
        autonomyLevel: 'requires_approval',
        autonomyNote: 'This is a system reliability issue, not a user productivity issue.',
        proof: 'If this keeps happening, support needs to investigate the background momentum job.'
      };
    }

    if ( this.isSenderProvisioningAlert( alert ) ) {
      return {
        id: 'setup-sender-provisioning',
        title: 'Finish sending setup',
        reason: this.buildSenderProvisioningReason( alert ),
        route: '/admin',
        actionLabel: 'Open Admin',
        priority: 'high',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval',
        autonomyNote: 'TODD cannot keep sending until tenant setup is complete.',
        proof: String( alert.recommendedFix || '' ).trim() || undefined
      };
    }

    if ( this.isMailboxConfigurationAlert( alert ) ) {
      return {
        id: 'setup-mailbox-config',
        title: 'Reconnect mailbox',
        reason: this.buildMailboxConfigurationReason( alert ),
        route: '/update-profile',
        actionLabel: 'Open Profile',
        priority: 'high',
        status: 'needs_you',
        source: 'setup',
        autonomyLevel: 'requires_approval',
        autonomyNote: 'TODD needs mailbox access before it can keep carrying reply and monitoring work.',
        proof: String( alert.recommendedFix || '' ).trim() || undefined
      };
    }

    if ( this.isGenericEmailAlert( alert ) ) {
      return {
        id: 'attention-email-review',
        title: 'Review email status',
        reason: 'TODD found an email-related issue that needs a quick review before the next automated step.',
        route: '/daily-momentum',
        actionLabel: 'Open Daily Momentum',
        priority: 'medium',
        status: 'needs_you',
        source: 'attention',
        autonomyLevel: 'requires_approval',
        autonomyNote: 'TODD found an email gate that still requires a human fix.',
        proof: String( alert.recommendedFix || '' ).trim() || undefined
      };
    }

    return null;
  }

  private isTemporaryMomentumDelayAlert ( alert: MomentumOpenAlert | undefined ): boolean {
    const area = String( alert?.area || '' ).trim().toLowerCase();
    const reason = String( alert?.reason || '' ).trim().toLowerCase();
    const combined = `${alert?.message || ''} ${alert?.recommendedFix || ''}`.toLowerCase();

    return reason === 'scheduled_operator_failed' ||
      ( area === 'momentum' && /deadline_exceeded|deadline exceeded|timed out|timeout|lb pick|remote_addr/.test( combined ) );
  }

  private isSenderProvisioningAlert ( alert: MomentumOpenAlert | undefined ): boolean {
    if ( this.isTemporaryMomentumDelayAlert( alert ) ) {
      return false;
    }

    const reason = String( alert?.reason || '' ).trim().toLowerCase();
    const combined = `${alert?.message || ''} ${alert?.reason || ''} ${alert?.recommendedFix || ''}`.toLowerCase();

    return /missing_sender|sender configuration|sender setup|sendgrid|domain authentication|authenticated domain|single sender|provisioning/.test( combined ) ||
      /missing_sender|sender|domain|provision/.test( reason );
  }

  private isMailboxConfigurationAlert ( alert: MomentumOpenAlert | undefined ): boolean {
    if ( this.isTemporaryMomentumDelayAlert( alert ) || this.isSenderProvisioningAlert( alert ) ) {
      return false;
    }

    const area = String( alert?.area || '' ).trim().toLowerCase();
    const reason = String( alert?.reason || '' ).trim().toLowerCase();
    const combined = `${alert?.message || ''} ${alert?.reason || ''} ${alert?.recommendedFix || ''}`.toLowerCase();

    return /mailbox|imap|smtp|inbox|sync mailbox|mailbox sync|reply mailbox/.test( combined ) ||
      /mailbox|imap|smtp|inbox/.test( reason ) ||
      ( area === 'email' && /mailbox|imap|smtp|inbox/.test( combined ) );
  }

  private isGenericEmailAlert ( alert: MomentumOpenAlert | undefined ): boolean {
    if ( this.isTemporaryMomentumDelayAlert( alert ) || this.isSenderProvisioningAlert( alert ) || this.isMailboxConfigurationAlert( alert ) ) {
      return false;
    }

    return String( alert?.area || '' ).trim().toLowerCase() === 'email';
  }

  private buildSenderProvisioningReason ( alert: MomentumOpenAlert | undefined ): string {
    const combined = `${alert?.message || ''} ${alert?.reason || ''} ${alert?.recommendedFix || ''}`.toLowerCase();

    if ( /domain|dkim|spf|dmarc|authenticated domain/.test( combined ) ) {
      return 'TODD needs the verified sending domain finished before automated sending can continue.';
    }

    if ( /sendgrid|single sender|provisioning/.test( combined ) ) {
      return 'TODD needs the tenant sending setup confirmed in admin before automated sending can continue.';
    }

    return 'TODD needs a sender configured for automated outreach before it can keep sending on its own.';
  }

  private buildMailboxConfigurationReason ( alert: MomentumOpenAlert | undefined ): string {
    const combined = `${alert?.message || ''} ${alert?.reason || ''} ${alert?.recommendedFix || ''}`.toLowerCase();

    if ( /sync|inbox/.test( combined ) ) {
      return 'TODD needs the connected mailbox checked so inbox sync can continue.';
    }

    return 'TODD needs the connected mailbox rechecked before email monitoring can continue.';
  }

  private normalizeGoalSnapshot ( viewModel: DailyMomentumViewModel, selectedGoalAmount: number ): DailyMomentumViewModel {
    const snapshot = viewModel?.snapshot || {} as DailyMomentumViewModel['snapshot'];
    const snapshotGoal = this.parseCurrencyAmount( snapshot.goalAmount );
    const hasSelectedGoal = Number.isFinite( Number( selectedGoalAmount ) );
    const safeSelectedGoal = hasSelectedGoal ? Number( selectedGoalAmount ) : snapshotGoal;
    const resolvedGoal = hasSelectedGoal ? Math.max( safeSelectedGoal, 0 ) : Math.max( snapshotGoal, 0 );
    const snapshotRevenue = this.parseCurrencyAmount( snapshot.revenueSoFar );
    const snapshotGap = this.parseCurrencyAmount( snapshot.gapRemaining );
    const effectiveGap = ( snapshotGap === 0 && snapshotRevenue < resolvedGoal )
      ? Math.max( resolvedGoal - snapshotRevenue, 0 )
      : Math.max( snapshotGap, 0 );

    return {
      ...viewModel,
      snapshot: {
        ...snapshot,
        goalAmount: this.formatCurrency( resolvedGoal ),
        gapRemaining: this.formatCurrency( effectiveGap )
      }
    };
  }

  private parseCurrencyAmount ( value: string | undefined ): number {
    const numeric = Number( String( value || '' ).replace( /[^0-9.-]/g, '' ) );
    return Number.isFinite( numeric ) ? numeric : 0;
  }

  private formatCurrency ( value: number ): string {
    return new Intl.NumberFormat( 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    } ).format( Number.isFinite( value ) ? value : 0 );
  }

  private joinProofItems ( items?: string[] ): string | undefined {
    const parts = Array.isArray( items ) ? items.filter( Boolean ).slice( 0, 2 ) : [];
    return parts.length ? parts.join( ' | ' ) : undefined;
  }

  private metricsToProof ( metrics?: Array<{ label: string; value: string; }> ): string | undefined {
    const parts = Array.isArray( metrics ) ? metrics.slice( 0, 2 ).map( metric => `${metric.label}: ${metric.value}` ) : [];
    return parts.length ? parts.join( ' | ' ) : undefined;
  }

  private parseCountValue ( value: string | undefined ): number {
    const numeric = Number( String( value || '' ).replace( /[^0-9.-]/g, '' ) );
    return Number.isFinite( numeric ) ? numeric : 0;
  }

  private inferApprovalCategoryFromRoute ( route?: string ): string {
    const normalized = String( route || '' ).toLowerCase();
    if ( normalized.startsWith( '/outreach/app' ) || normalized.startsWith( '/outbox' ) ) return 'outreach_sending';
    if ( normalized.startsWith( '/outreach/social/calendar' ) ) return 'social_drafting';
    if ( normalized.startsWith( '/outreach/social' ) ) return 'social_posting';
    if ( normalized.startsWith( '/lead-vault' ) ) return 'lead_addition';
    return 'manual_gate';
  }

  private inferApprovalCategoryFromAction ( action: DailyMomentumActionRow ): string {
    const raw = `${action.route || ''} ${action.label || ''} ${action.actionType || ''} ${action.detail || ''}`.toLowerCase();
    if ( /outreach|follow-up|warm|outbox|email/.test( raw ) ) return 'outreach_sending';
    if ( /social\/source|draft/.test( raw ) || /linkedin|threads|bluesky|facebook|instagram|youtube|social/.test( raw ) ) return 'social_drafting';
    if ( /social/.test( raw ) ) return 'social_posting';
    if ( /lead vault|lead_addition|lead addition/.test( raw ) ) return 'lead_addition';
    return 'manual_gate';
  }

  private buildApprovalOutcomeTitle ( action: DailyMomentumApprovalAction ): string {
    const route = String( action.route || '' ).toLowerCase();
    if ( route.startsWith( '/outreach/app' ) || route.startsWith( '/outbox' ) ) {
      return 'Outreach batch prepared';
    }
    if ( route.startsWith( '/outreach/social/calendar' ) ) {
      return 'Social work prepared';
    }
    if ( route.startsWith( '/outreach/social' ) ) {
      return 'Social work queued';
    }
    return action.label || 'Prepared work waiting';
  }

  private buildApprovalOutcomeReason ( action: DailyMomentumApprovalAction, category: string ): string {
    if ( category === 'outreach_sending' ) {
      return 'TODD already prepared the outreach batch. The only thing slowing momentum now is the explicit send approval gate.';
    }
    if ( category === 'social_drafting' ) {
      return 'TODD already created the social work. The only thing slowing momentum now is the review gate before it can keep moving.';
    }
    if ( category === 'social_posting' ) {
      return 'TODD already has approved social work in queue. Publishing is still waiting at the final human gate.';
    }
    return action.description || action.missingApproval || 'TODD prepared work that still needs a human gate cleared.';
  }

  private buildApprovalAutonomyNote ( category: string ): string {
    if ( category === 'outreach_sending' ) {
      return 'Current policy: requires approval before TODD can send or queue outreach.';
    }
    if ( category === 'social_drafting' || category === 'social_posting' ) {
      return 'Current policy: social momentum is still approval-gated instead of being allowed to carry forward on its own.';
    }
    return 'Current policy: TODD is waiting at a manual gate.';
  }

  private resolveAutonomyLevelForAction ( action: DailyMomentumActionRow, source: DailyCommandSource ): DailyCommandAutonomyLevel {
    const state = String( action.state || '' ).trim().toLowerCase();
    if ( state === 'auto_executed' || state === 'completed' || state === 'queued' ) return 'auto';
    if ( state === 'prepared_by_todd' || source === 'signal' || source === 'goal_recovery' || source === 'fallback' ) return 'auto_after_timeout';
    return 'requires_approval';
  }

  private buildActionAutonomyNote ( action: DailyMomentumActionRow, source: DailyCommandSource ): string {
    const state = String( action.state || '' ).trim().toLowerCase();
    if ( state === 'auto_executed' || state === 'completed' ) {
      return 'TODD already carried this step without stopping at a human checkpoint.';
    }
    if ( state === 'queued' ) {
      return 'TODD already moved this into the live queue.';
    }
    if ( state === 'prepared_by_todd' || source === 'signal' ) {
      return 'TODD has enough signal to keep carrying this path. The next product step should reduce human waiting here.';
    }
    return 'This path is still waiting on a human checkpoint.';
  }

  private getApprovalModeForCategory ( viewModel: DailyMomentumViewModel, category: string ): 'manual' | 'approval-first' | 'auto' {
    const categories = Array.isArray( viewModel.approvalPolicySettings?.categories )
      ? viewModel.approvalPolicySettings.categories
      : [];
    const match = categories.find( item => String( item?.category || '' ).trim() === category );
    const mode = String( match?.mode || '' ).trim().toLowerCase();
    return mode === 'auto' || mode === 'manual' || mode === 'approval-first'
      ? mode as 'manual' | 'approval-first' | 'auto'
      : 'approval-first';
  }

  private toRouteActionLabel ( route: string, fallback: string ): string {
    const normalized = String( route || '' ).toLowerCase();
    if ( normalized.startsWith( '/signal-engine' ) ) return 'Open Outbox Cockpit';
    if ( normalized.startsWith( '/outreach/social/calendar' ) ) return 'Open Calendar';
    if ( normalized.startsWith( '/outreach/social' ) ) return 'Open Social Queue';
    if ( normalized.startsWith( '/outreach/app' ) ) return 'Open Outreach';
    if ( normalized.startsWith( '/daily-momentum' ) ) return 'Open Daily Momentum';
    if ( normalized.startsWith( '/tasks' ) ) return 'Open Moves';
    if ( normalized.startsWith( '/admin' ) ) return 'Open Admin';
    if ( normalized.startsWith( '/update-profile' ) || normalized.startsWith( '/user-profile' ) ) return 'Open Profile';
    if ( normalized.startsWith( '/settings' ) ) return 'Open Settings';
    return fallback;
  }

  private auditItemToEvidence ( item: DailyMomentumAuditItem, index: number ): DailyCommandEvidence {
    return {
      id: `audit-${index}`,
      label: item.label || 'Momentum check',
      summary: item.detail || item.proofLine || 'TODD checked part of today\'s operating picture.',
      tone: item.state === 'attention' ? 'attention' : 'info'
    };
  }

  private shouldSuppressAuditItem (
    item: DailyMomentumAuditItem,
    resolvedGoal: number,
    calendarConnected: boolean,
    integrationState: DailyCommandIntegrationState
  ): boolean {
    const label = String( item.label || '' ).trim().toLowerCase();
    const detail = String( item.detail || item.proofLine || '' ).trim().toLowerCase();
    const combined = `${label} ${detail}`;

    if ( /outreach reviewed|follow-ups sent|warm inventory|send/.test( combined ) && !integrationState.hasProvisionedSender ) {
      return true;
    }

    if ( /social|linkedin|bluesky|threads|facebook|instagram|youtube/.test( combined ) && !integrationState.hasConnectedSocialAccounts ) {
      return true;
    }

    if ( resolvedGoal > 0 ) {
      return false;
    }

    if ( /revenue source checked|stripe checked/.test( combined ) ) {
      return true;
    }

    if ( /calendar checked/.test( combined ) && !calendarConnected ) {
      return true;
    }

    if ( /outreach reviewed|social|linkedin|lead vault/.test( combined ) ) {
      return true;
    }

    return false;
  }

  private buildIntegrationState ( tenant: any | null, socialAccounts: SocialAccount[] = [], surveys: Survey[] | null = null ): DailyCommandIntegrationState {
    return {
      tenant,
      socialAccounts,
      hasConnectedSocialAccounts: this.hasConnectedSocialAccounts( socialAccounts ),
      hasProvisionedSender: this.hasProvisionedSender( tenant ),
      surveys
    };
  }

  private hasConnectedSocialAccounts ( socialAccounts: SocialAccount[] = [] ): boolean {
    return ( Array.isArray( socialAccounts ) ? socialAccounts : [] ).some( account => {
      const accountId = String( account?.accountId || '' ).trim();
      const status = String( account?.status || '' ).trim().toLowerCase();
      const connectedAt = String( account?.connectedAt || '' ).trim();
      const hasAccessToken = account?.tokenStatus?.hasAccessToken !== false;
      const needsReauth = account?.tokenStatus?.needsReauth === true;
      return !!accountId
        && ['connected', 'active', 'ready', 'healthy'].includes( status )
        && !!connectedAt
        && hasAccessToken
        && !needsReauth;
    } );
  }

  private hasProvisionedSender ( tenant: any | null ): boolean {
    const status = String( tenant?.outreachProvisioningStatus || '' ).trim().toLowerCase();
    const senderEmail = String( tenant?.outreachSenderEmail || '' ).trim().toLowerCase();
    return ['provisioned', 'active', 'ready'].includes( status ) && !!senderEmail;
  }

  private mapEngineEvidenceTone ( raw: string ): DailyCommandEvidence['tone'] {
    const normalized = String( raw || '' ).toLowerCase();
    if ( normalized === 'blocked' || normalized === 'failed' ) return 'warn';
    if ( normalized === 'setup_needed' || normalized === 'approval_needed' || normalized === 'waiting_for_approval' ) return 'attention';
    if ( normalized === 'completed' ) return 'positive';
    return 'info';
  }

  private mapReceiptTone ( raw: string ): DailyCommandEvidence['tone'] {
    const normalized = String( raw || '' ).toLowerCase();
    if ( /failed|blocked|error/.test( normalized ) ) return 'warn';
    if ( /attention|warning|warn/.test( normalized ) ) return 'attention';
    if ( /done|completed|success|positive/.test( normalized ) ) return 'positive';
    return 'info';
  }

  private selectSocialGrowthPost ( posts: SocialPost[] = [] ): SocialPost | null {
    const candidates = ( Array.isArray( posts ) ? posts : [] ).filter( post => !!String( post?.postId || '' ).trim() );
    if ( !candidates.length ) {
      return null;
    }

    const statusPriority: Record<string, number> = {
      needs_human_engagement: 700,
      needs_amplification: 650,
      awaiting_signal: 600,
      needs_recovery: 560,
      ready_to_publish: 520,
      winner_expand_now: 480,
      preparing: 300
    };

    return [...candidates].sort( ( a, b ) => {
      const aStatus = String( a.growthState?.status || '' ).trim().toLowerCase();
      const bStatus = String( b.growthState?.status || '' ).trim().toLowerCase();
      const aPending = ( Array.isArray( a.requiredActions ) ? a.requiredActions : [] ).some( action => String( action?.status || 'pending' ).toLowerCase() === 'pending' );
      const bPending = ( Array.isArray( b.requiredActions ) ? b.requiredActions : [] ).some( action => String( action?.status || 'pending' ).toLowerCase() === 'pending' );
      const aTime = new Date( a.growthState?.nextCheckAt || a.publishedTimestamp || a.updatedAt || 0 ).getTime();
      const bTime = new Date( b.growthState?.nextCheckAt || b.publishedTimestamp || b.updatedAt || 0 ).getTime();
      const aScore = ( statusPriority[aStatus] || 0 ) + ( aPending ? 40 : 0 );
      const bScore = ( statusPriority[bStatus] || 0 ) + ( bPending ? 40 : 0 );

      if ( aScore !== bScore ) {
        return bScore - aScore;
      }

      return bTime - aTime;
    } )[0] || null;
  }

  private findRecoveryDraftForPost ( post: SocialPost, posts: SocialPost[] = [] ): SocialPost | null {
    const sourceType = String( post?.sourceContentReference?.sourceType || '' ).trim();
    const sourceId = String( post?.sourceContentReference?.sourceId || '' ).trim();
    const platform = String( post?.platform || '' ).trim().toLowerCase();
    const originalPostId = String( post?.postId || '' ).trim();

    if ( !sourceType || !sourceId || !platform || !originalPostId ) {
      return null;
    }

    return ( Array.isArray( posts ) ? posts : [] ).find( candidate =>
      String( candidate?.postId || '' ).trim() !== originalPostId
      && String( candidate?.status || '' ).trim().toLowerCase() === 'draft'
      && String( candidate?.platform || '' ).trim().toLowerCase() === platform
      && String( candidate?.sourceContentReference?.sourceType || '' ).trim() === sourceType
      && String( candidate?.sourceContentReference?.sourceId || '' ).trim() === sourceId
    ) || null;
  }

  private resolveSocialGrowthDirectorStatus ( post: SocialPost, recoveryDraft: SocialPost | null ): string {
    const growthStatus = String( post?.growthState?.status || '' ).trim().toLowerCase();
    if ( growthStatus === 'needs_recovery' && recoveryDraft ) {
      return 'recovery_draft_ready';
    }
    return growthStatus;
  }

  private toSocialGrowthStatusLabel ( status: string | null | undefined ): string {
    const normalized = String( status || '' ).trim().toLowerCase();

    switch ( normalized ) {
      case 'needs_human_engagement':
        return 'Needs human engagement';
      case 'needs_amplification':
        return 'Needs amplification';
      case 'awaiting_signal':
        return 'Awaiting signal';
      case 'needs_recovery':
        return 'Needs recovery';
      case 'recovery_draft_ready':
        return 'Recovery draft ready';
      case 'winner_expand_now':
        return 'Winner: expand now';
      case 'ready_to_publish':
        return 'Ready to publish';
      case 'strategy_ready':
        return 'Strategy ready';
      case 'drafts_ready':
        return 'Drafts ready';
      default:
        return 'Social growth';
    }
  }

  private resolveFallbackSocialPlatformLabel (
    socialBootstrap: SocialBootstrapPayload | null,
    integrationState: DailyCommandIntegrationState,
    strategy: SocialDraftStrategyContext | null
  ): string {
    const strategyPlatform = String( strategy?.selectedPlatform || strategy?.platformFocus || strategy?.socialChannelFocus || '' ).trim().toLowerCase();
    if ( strategyPlatform && strategyPlatform !== 'auto' && strategyPlatform !== 'balanced' ) {
      return this.toPlatformLabel( strategyPlatform );
    }

    const bootstrapAccount = ( Array.isArray( socialBootstrap?.accounts ) ? socialBootstrap?.accounts : [] )
      .find( account => !!String( account?.provider || '' ).trim() );
    const connectedAccount = integrationState.socialAccounts.find( account => !!String( account?.provider || '' ).trim() );
    const provider = String(
      bootstrapAccount?.provider
      || connectedAccount?.provider
      || 'social'
    ).trim().toLowerCase();
    return this.toPlatformLabel( provider );
  }

  private toStrategyGoalLabel ( goal: string | null | undefined ): string {
    switch ( String( goal || '' ).trim().toLowerCase() ) {
      case 'grow_awareness':
        return 'Grow awareness';
      case 'grow_followers':
        return 'Grow followers';
      case 'drive_engagement':
        return 'Drive engagement';
      case 'build_authority':
        return 'Build authority';
      case 'drive_traffic':
        return 'Drive traffic';
      case 'generate_leads':
        return 'Generate leads';
      default:
        return 'Social growth';
    }
  }

  private toCadenceLabel ( cadence: string | null | undefined ): string {
    switch ( String( cadence || '' ).trim().toLowerCase() ) {
      case '2x_day':
        return '2x/day';
      case 'daily':
        return 'Daily';
      case '5x_week':
        return '5x/week';
      case '3x_week':
        return '3x/week';
      case '2x_week':
        return '2x/week';
      case 'weekly':
        return 'Weekly';
      default:
        return '';
    }
  }

  private compactProofParts ( parts: Array<string | null | undefined> ): string | null {
    const normalized = parts.map( part => String( part || '' ).trim() ).filter( Boolean );
    return normalized.length ? normalized.join( ' · ' ) : null;
  }

  private buildSocialGrowthDiagnosis ( post: SocialPost, recoveryDraft: SocialPost | null ): string {
    const status = this.resolveSocialGrowthDirectorStatus( post, recoveryDraft );
    if ( status === 'recovery_draft_ready' ) {
      return 'The original post missed its first signal window, and TODD already staged a stronger recovery draft for review.';
    }
    return String( post?.growthState?.diagnosis || post?.growthState?.reason || 'TODD is reading the current social lane and choosing the next growth move.' ).trim();
  }

  private describeToddNextSocialMove ( post: SocialPost, pendingAction: NonNullable<SocialPost['requiredActions']>[number] | null, recoveryDraft: SocialPost | null ): string {
    const status = this.resolveSocialGrowthDirectorStatus( post, recoveryDraft );

    switch ( status ) {
      case 'needs_human_engagement':
        return 'Reply to the warm comments now so TODD can measure whether this post is pulling real conversation.';
      case 'needs_amplification':
        return 'Give this post one manual distribution push so TODD can decide whether it needs another round or a stronger rewrite.';
      case 'awaiting_signal':
        return 'Let TODD collect the first performance numbers before it decides whether to push harder, reply, or rewrite.';
      case 'needs_recovery':
        return 'This post missed its first traction window, so TODD should prepare a stronger second version.';
      case 'recovery_draft_ready':
        return 'The stronger recovery version is ready. Review it and release it if it feels right.';
      case 'winner_expand_now':
        return 'This topic is working. TODD should turn it into the next follow-up post while attention is still warm.';
      case 'ready_to_publish':
        return 'This post is ready. The only thing left is to release it in the next publish window.';
      default:
        return pendingAction
          ? 'TODD already picked the next move and prepared the step it still needs from you.'
          : 'TODD is watching the live social lane and will keep updating the next growth move.';
    }
  }

  private buildSocialGrowthUserActionTitle (
    post: SocialPost,
    pendingAction: NonNullable<SocialPost['requiredActions']>[number] | null,
    recoveryDraft: SocialPost | null
  ): string | null {
    const status = this.resolveSocialGrowthDirectorStatus( post, recoveryDraft );
    if ( status === 'recovery_draft_ready' ) {
      return 'Review the recovery draft';
    }
    return pendingAction ? String( pendingAction.title || '' ).trim() || null : null;
  }

  private buildSocialGrowthUserActionInstruction (
    post: SocialPost,
    pendingAction: NonNullable<SocialPost['requiredActions']>[number] | null,
    recoveryDraft: SocialPost | null
  ): string | null {
    const status = this.resolveSocialGrowthDirectorStatus( post, recoveryDraft );
    if ( status === 'recovery_draft_ready' ) {
      return 'Open the new recovery draft, review the stronger hook and framing, and approve it if it is ready to replace the stalled post.';
    }
    return pendingAction ? String( pendingAction.instruction || '' ).trim() || null : null;
  }

  private buildSocialGrowthUserActionReason (
    post: SocialPost,
    pendingAction: NonNullable<SocialPost['requiredActions']>[number] | null,
    recoveryDraft: SocialPost | null
  ): string | null {
    const status = this.resolveSocialGrowthDirectorStatus( post, recoveryDraft );
    if ( status === 'recovery_draft_ready' ) {
      return 'TODD already handled the rewrite step, so the only human move left is to review and release the stronger recovery version.';
    }
    return pendingAction ? String( pendingAction.reason || '' ).trim() || null : null;
  }

  private buildSocialGrowthUserActionLabel (
    post: SocialPost,
    pendingAction: NonNullable<SocialPost['requiredActions']>[number] | null,
    recoveryDraft: SocialPost | null
  ): string | null {
    const status = this.resolveSocialGrowthDirectorStatus( post, recoveryDraft );
    if ( status === 'recovery_draft_ready' ) {
      return 'Open recovery draft';
    }
    return pendingAction ? this.toSocialActionLabel( pendingAction.type ) : null;
  }

  private toSocialActionLabel ( type: string | null | undefined ): string {
    const normalized = String( type || '' ).trim().toLowerCase();

    switch ( normalized ) {
      case 'reply_to_comment':
        return 'Open comment replies';
      case 'share_to_story':
        return 'Open Story follow-up';
      case 'post_comment':
        return 'Open post follow-up';
      case 'record_metrics':
        return 'Record performance';
      default:
        return 'Open social work';
    }
  }

  private buildSocialGrowthRoute (
    post: SocialPost,
    pendingAction: NonNullable<SocialPost['requiredActions']>[number] | null,
    recoveryDraft: SocialPost | null
  ): string {
    const postId = encodeURIComponent( String( post?.postId || '' ).trim() );
    const recoveryDraftPostId = encodeURIComponent( String( recoveryDraft?.postId || '' ).trim() );
    const status = this.resolveSocialGrowthDirectorStatus( post, recoveryDraft );
    const actionType = String( pendingAction?.type || '' ).trim().toLowerCase();

    if ( !postId ) {
      return '/outreach/social/calendar';
    }

    if ( status === 'recovery_draft_ready' && recoveryDraftPostId ) {
      return `/outreach/social/calendar?handoffPostIds=${recoveryDraftPostId}`;
    }

    if ( status === 'ready_to_publish' ) {
      return `/outreach/social/queue?focusPostId=${postId}#approved-posts`;
    }

    if ( [
      'needs_human_engagement',
      'needs_amplification',
      'awaiting_signal',
      'needs_recovery',
      'winner_expand_now'
    ].includes( status ) || [
      'reply_to_comment',
      'share_to_story',
      'post_comment',
      'record_metrics'
    ].includes( actionType ) ) {
      return `/outreach/social/signals?focusPostId=${postId}#social-signals`;
    }

    return `/outreach/social/calendar?handoffPostIds=${postId}`;
  }

  private toNextCheckLabel ( iso: string | null | undefined ): string | null {
    const raw = String( iso || '' ).trim();
    if ( !raw ) {
      return null;
    }

    const parsed = new Date( raw );
    if ( Number.isNaN( parsed.getTime() ) ) {
      return null;
    }

    return `Next TODD check: ${parsed.toLocaleString( 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    } )}`;
  }
}
