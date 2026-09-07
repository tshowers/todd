import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { AppUser, CompanyOverview, Contact, GradingWeights, TenantInvite, UserRole } from '../shared/data/interfaces/contact.model';
import { CockpitActivityItem } from './cockpit-activity.service';


import { Observable, map, firstValueFrom, BehaviorSubject, combineLatest } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
} from '@angular/fire/firestore';
import { DEFAULT_WEIGHTS } from '../features/contact/utils/grading-engine.util';
import { buildPhoneLookupKeys } from './helpers/phone-normalization.helper';
import { environment } from '../../environments/environment';



@Injectable( {
  providedIn: 'root'
} )
export class AdminControlService {
  private static readonly MAX_TENANT_MEMBERS = 5;
  private cypressStateLoaded = false;
  private cypressUsersSubject = new BehaviorSubject<AppUser[]>( [] );
  private cypressPendingCompaniesSubject = new BehaviorSubject<CompanyOverview[]>( [] );
  private cypressWeightsSubject = new BehaviorSubject<GradingWeights>( DEFAULT_WEIGHTS );
  private cypressTenantsSubject = new BehaviorSubject<Record<string, any>>( {} );
  private cypressInvitesSubject = new BehaviorSubject<TenantInvite[]>( [] );

  constructor () { }

  private firestore = inject( Firestore );
  private http = inject( HttpClient );
  private injector = inject( Injector );

  private inContext<T> ( operation: () => T ): T {
    return runInInjectionContext( this.injector, operation );
  }

  private isCypressMode (): boolean {
    return typeof window !== 'undefined' && !!( window as any ).Cypress;
  }

  private loadCypressState (): void {
    if ( !this.isCypressMode() || this.cypressStateLoaded ) {
      return;
    }

    this.cypressStateLoaded = true;

    try {
      const raw = window.localStorage.getItem( '__cypressAdminState' );
      if ( !raw ) {
        return;
      }

      const parsed = JSON.parse( raw );
      this.cypressUsersSubject.next( Array.isArray( parsed?.users ) ? parsed.users : [] );
      this.cypressPendingCompaniesSubject.next( Array.isArray( parsed?.pendingCompanies ) ? parsed.pendingCompanies : [] );
      this.cypressWeightsSubject.next( {
        ...DEFAULT_WEIGHTS,
        ...( parsed?.weights || {} ),
      } as GradingWeights );
      this.cypressTenantsSubject.next( parsed?.tenants && typeof parsed.tenants === 'object' ? parsed.tenants : {} );
      this.cypressInvitesSubject.next( Array.isArray( parsed?.invites ) ? parsed.invites : [] );
    } catch {
      this.cypressUsersSubject.next( [] );
      this.cypressPendingCompaniesSubject.next( [] );
      this.cypressWeightsSubject.next( DEFAULT_WEIGHTS );
      this.cypressTenantsSubject.next( {} );
      this.cypressInvitesSubject.next( [] );
    }
  }

  private persistCypressState (): void {
    if ( !this.isCypressMode() ) {
      return;
    }

    window.localStorage.setItem( '__cypressAdminState', JSON.stringify( {
      users: this.cypressUsersSubject.value,
      pendingCompanies: this.cypressPendingCompaniesSubject.value,
      weights: this.cypressWeightsSubject.value,
      tenants: this.cypressTenantsSubject.value,
      invites: this.cypressInvitesSubject.value,
    } ) );
  }

  private updateCypressUsers ( updater: ( users: AppUser[] ) => AppUser[] ): void {
    this.loadCypressState();
    this.cypressUsersSubject.next( updater( [...this.cypressUsersSubject.value] ) );
    this.persistCypressState();
  }

  private updateCypressTenants ( updater: ( tenants: Record<string, any> ) => Record<string, any> ): void {
    this.loadCypressState();
    this.cypressTenantsSubject.next( updater( { ...this.cypressTenantsSubject.value } ) );
    this.persistCypressState();
  }

  private updateCypressInvites ( updater: ( invites: TenantInvite[] ) => TenantInvite[] ): void {
    this.loadCypressState();
    this.cypressInvitesSubject.next( updater( [...this.cypressInvitesSubject.value] ) );
    this.persistCypressState();
  }

  private buildInviteId ( tenantId: string, email: string ): string {
    return `${String( tenantId || '' ).trim()}__${String( email || '' ).trim().toLowerCase()}`;
  }

  // ---- USERS ----

  getUsers$ (): Observable<AppUser[]> {
    if ( this.isCypressMode() ) {
      this.loadCypressState();
      return this.cypressUsersSubject.asObservable();
    }

    const ref = collection( this.firestore, 'users' ); // or 'tenantUsers'
    return collectionData( ref, { idField: 'id' } ) as Observable<AppUser[]>;
  }

  async updateUserRole ( userId: string, role: UserRole ): Promise<void> {
    if ( this.isCypressMode() ) {
      this.updateCypressUsers( users =>
        users.map( user => user.id === userId ? { ...user, role } : user )
      );
      return;
    }

    const ref = doc( this.firestore, 'users', userId );
    await updateDoc( ref, { role } );
  }

  async toggleUserStatus ( userId: string, status: 'active' | 'disabled' ): Promise<void> {
    if ( this.isCypressMode() ) {
      this.updateCypressUsers( users =>
        users.map( user => user.id === userId ? { ...user, status } : user )
      );
      return;
    }

    const ref = doc( this.firestore, 'users', userId );
    await updateDoc( ref, { status } );
  }

  // ---- COMPANIES / PROFILES ----

  getPendingCompanies$ (): Observable<CompanyOverview[]> {
    if ( this.isCypressMode() ) {
      this.loadCypressState();
      return this.cypressPendingCompaniesSubject.asObservable();
    }

    const ref = collection( this.firestore, 'companies' );
    const q = query( ref, where( 'status', '==', 'pending' ) );
    return collectionData( q, { idField: 'id' } ) as Observable<CompanyOverview[]>;
  }

  async approveCompany ( company: CompanyOverview ): Promise<void> {
    if ( this.isCypressMode() ) {
      this.loadCypressState();
      this.cypressPendingCompaniesSubject.next(
        this.cypressPendingCompaniesSubject.value.filter( item => item.id !== company.id )
      );
      this.persistCypressState();
      return;
    }

    const ref = doc( this.firestore, 'companies', company.id );
    const publicPortfolioUrl =
      company.publicPortfolioUrl || `/portfolio/${company.id}`;
    await updateDoc( ref, {
      status: 'approved',
      isPublic: true,
      publicPortfolioUrl,
    } );
  }

  async rejectCompany ( companyId: string, reason?: string ): Promise<void> {
    if ( this.isCypressMode() ) {
      this.loadCypressState();
      this.cypressPendingCompaniesSubject.next(
        this.cypressPendingCompaniesSubject.value.filter( item => item.id !== companyId )
      );
      this.persistCypressState();
      return;
    }

    const ref = doc( this.firestore, 'companies', companyId );
    const payload: any = { status: 'rejected', isPublic: false };
    if ( reason ) payload.rejectionReason = reason;
    await updateDoc( ref, payload );
  }

  getTenant$ ( tenantId: string ): Observable<any | null> {
    const normalizedTenantId = ( tenantId || '' ).trim();
    if ( !normalizedTenantId ) {
      return new Observable( observer => {
        observer.next( null );
        observer.complete();
      } );
    }

    if ( this.isCypressMode() ) {
      this.loadCypressState();
      return this.cypressTenantsSubject.asObservable().pipe(
        map( tenants => tenants[normalizedTenantId] || null )
      );
    }

    const ref = doc( this.firestore, 'tenants', normalizedTenantId );
    return this.inContext( () => docData( ref, { idField: 'id' } ) ).pipe(
      map( data => data || null )
    );
  }

  getTenantMembers$ ( tenantId: string ): Observable<AppUser[]> {
    const normalizedTenantId = ( tenantId || '' ).trim();
    if ( !normalizedTenantId ) {
      return new Observable( observer => {
        observer.next( [] );
        observer.complete();
      } );
    }

    if ( this.isCypressMode() ) {
      this.loadCypressState();
      return this.getUsers$().pipe(
        map( users => users
          .filter( user => user.companyId === normalizedTenantId )
          .map( user => this.toTenantMember( user ) )
        )
      );
    }

    const ref = collection( this.firestore, 'users' );
    const q = query( ref, where( 'companyId', '==', normalizedTenantId ) );
    return ( this.inContext( () => collectionData( q, { idField: 'id' } ) ) as Observable<AppUser[]> ).pipe(
      map( users => users.map( user => this.toTenantMember( user ) ) )
    );
  }

  getTenantOwnerUser$ ( tenantId: string ): Observable<AppUser | null> {
    const normalizedTenantId = ( tenantId || '' ).trim();
    if ( !normalizedTenantId ) {
      return new Observable( observer => {
        observer.next( null );
        observer.complete();
      } );
    }

    if ( this.isCypressMode() ) {
      this.loadCypressState();
      return this.cypressTenantsSubject.asObservable().pipe(
        map( tenants => {
          const tenant = tenants[normalizedTenantId] || {};
          const ownerEmail = String( tenant?.ownerEmail || tenant?.email || '' ).trim().toLowerCase();
          if ( !ownerEmail ) {
            return null;
          }

          return {
            id: normalizedTenantId,
            email: ownerEmail,
            displayName: String( tenant?.ownerName || tenant?.displayName || ownerEmail ).trim(),
            role: 'admin' as UserRole,
            companyId: normalizedTenantId,
            status: 'active' as const
          };
        } )
      );
    }

    const ref = doc( this.firestore, `tenants/${normalizedTenantId}/contacts/${normalizedTenantId}` );
    return this.inContext( () => docData( ref, { idField: 'id' } ) ).pipe(
      map( raw => this.toTenantOwnerUser( raw as Contact | null, normalizedTenantId ) )
    );
  }

  searchUsersByEmailOrName$ ( term: string ): Observable<AppUser[]> {
    const normalizedTerm = ( term || '' ).trim().toLowerCase();
    if ( !normalizedTerm ) {
      return new Observable( observer => {
        observer.next( [] );
        observer.complete();
      } );
    }

    return this.getUsers$().pipe(
      map( users => users
        .filter( user => {
          const email = user.email?.trim().toLowerCase() || '';
          const displayName = user.displayName?.trim().toLowerCase() || '';
          return email.includes( normalizedTerm ) || displayName.includes( normalizedTerm );
        } )
        .map( user => this.toTenantMember( user ) )
      )
    );
  }

  async addUserToTenant ( tenantId: string, userId: string ): Promise<void> {
    const normalizedTenantId = ( tenantId || '' ).trim();
    const normalizedUserId = ( userId || '' ).trim();

    if ( !normalizedTenantId ) {
      throw new Error( 'Invalid tenant: tenant id is required.' );
    }

    if ( !normalizedUserId ) {
      throw new Error( 'Invalid user: user id is required.' );
    }

    const tenant = await firstValueFrom( this.getTenant$( normalizedTenantId ) );
    if ( !tenant ) {
      throw new Error( 'Invalid tenant: tenant not found.' );
    }

    const user = await this.getUserById( normalizedUserId );
    if ( !user ) {
      throw new Error( 'Invalid user: user not found.' );
    }

    if ( user.companyId === normalizedTenantId ) {
      throw new Error( 'User already exists.' );
    }

    const members = await firstValueFrom( this.getTenantMembers$( normalizedTenantId ) );
    if ( members.length >= AdminControlService.MAX_TENANT_MEMBERS ) {
      throw new Error( `Tenant member cap reached (${AdminControlService.MAX_TENANT_MEMBERS}).` );
    }

    if ( this.isCypressMode() ) {
      this.updateCypressUsers( users =>
        users.map( item => item.id === normalizedUserId ? { ...item, companyId: normalizedTenantId } : item )
      );
      return;
    }

    const ref = doc( this.firestore, 'users', normalizedUserId );
    await updateDoc( ref, { companyId: normalizedTenantId } );
  }

  async removeUserFromTenant ( tenantId: string, userId: string ): Promise<void>;
  async removeUserFromTenant ( userId: string ): Promise<void>;
  async removeUserFromTenant ( tenantIdOrUserId: string, userId?: string ): Promise<void> {
    const normalizedTenantId = ( userId ? tenantIdOrUserId : '' ).trim();
    const normalizedUserId = ( userId || tenantIdOrUserId || '' ).trim();

    if ( !normalizedUserId ) {
      throw new Error( 'Invalid user: user id is required.' );
    }

    const user = await this.getUserById( normalizedUserId );
    if ( !user ) {
      throw new Error( 'Invalid user: user not found.' );
    }

    const resolvedTenantId = normalizedTenantId || ( user.companyId || '' ).trim();
    if ( !resolvedTenantId ) {
      throw new Error( 'Invalid tenant: tenant id is required.' );
    }

    const tenant = await firstValueFrom( this.getTenant$( resolvedTenantId ) );
    if ( !tenant ) {
      throw new Error( 'Invalid tenant: tenant not found.' );
    }

    if ( user.companyId !== resolvedTenantId ) {
      throw new Error( 'User is not a member.' );
    }

    if ( this.isCypressMode() ) {
      this.updateCypressUsers( users =>
        users.map( item => item.id === normalizedUserId ? { ...item, companyId: undefined } : item )
      );
      return;
    }

    const ref = doc( this.firestore, 'users', normalizedUserId );
    await updateDoc( ref, { companyId: null } );
  }

  async findUserByEmailOrId ( value: string ): Promise<AppUser | null> {
    const normalizedValue = ( value || '' ).trim();
    if ( !normalizedValue ) return null;

    const users = await firstValueFrom( this.getUsers$() );
    const normalizedLower = normalizedValue.toLowerCase();

    return users.find( user =>
      user.id === normalizedValue ||
      user.email?.trim().toLowerCase() === normalizedLower
    ) || null;
  }

  async assignUserToTenant ( userId: string, tenantId: string ): Promise<void> {
    await this.addUserToTenant( tenantId, userId );
  }

  async clearUserTenantMembership ( userId: string ): Promise<void> {
    await this.removeUserFromTenant( userId );
  }

  async createOrUpdateTenantInvite ( payload: {
    tenantId: string;
    email: string;
    displayName: string;
    phone?: string;
    role: UserRole;
    invitedByUid?: string;
  } ): Promise<TenantInvite> {
    const tenantId = String( payload.tenantId || '' ).trim();
    const email = String( payload.email || '' ).trim().toLowerCase();
    const displayName = String( payload.displayName || '' ).trim();
    const phone = String( payload.phone || '' ).trim();
    const role = payload.role;

    if ( !tenantId ) throw new Error( 'Tenant ID is required.' );
    if ( !email ) throw new Error( 'Invite email is required.' );
    if ( !displayName ) throw new Error( 'Invite name is required.' );

    const invite: TenantInvite = {
      id: this.buildInviteId( tenantId, email ),
      tenantId,
      email,
      emailLower: email,
      displayName,
      phone,
      phoneLookupKeys: buildPhoneLookupKeys( [phone] ),
      role,
      status: 'pending',
      invitedByUid: String( payload.invitedByUid || '' ).trim() || undefined,
      invitedAt: new Date().toISOString(),
    };

    if ( this.isCypressMode() ) {
      this.updateCypressInvites( invites => {
        const next = invites.filter( item => item.id !== invite.id );
        next.push( invite );
        return next;
      } );
      return invite;
    }

    const inviteRef = doc( this.firestore, 'tenantInvites', invite.id );
    await setDoc( inviteRef, invite, { merge: true } );
    return invite;
  }

  previewSayItTestInvite ( payload: {
    uid: string;
    email?: string;
    displayName?: string;
    businessName?: string;
    appBaseUrl?: string;
  } ): Observable<{ success: boolean; html: string; subject?: string; loginUrl?: string; }> {
    return this.http.post<{ success: boolean; html: string; subject?: string; loginUrl?: string; }>(
      `${environment.backendURL}/sayit/seeding/preview-test-invite`,
      payload
    );
  }

  sendSayItTestInvite ( payload: {
    uid: string;
    email: string;
    displayName?: string;
    businessName?: string;
    appBaseUrl?: string;
  } ): Observable<{ success: boolean; message?: string; subject?: string; loginUrl?: string; }> {
    return this.http.post<{ success: boolean; message?: string; subject?: string; loginUrl?: string; }>(
      `${environment.backendURL}/sayit/seeding/send-test-invite`,
      payload
    );
  }

  sendMomentumGeneratedEmailTest ( payload: {
    tenantId: string;
    testType: string;
  } ): Observable<{
    success: boolean;
    message?: string;
    data?: {
      sentTo?: string;
      fromEmail?: string;
      testType?: string;
      testLabel?: string;
      subject?: string;
      summary?: string;
      sampledContact?: {
        id?: string;
        name?: string;
        email?: string;
        companyName?: string;
      } | null;
      sampledThread?: {
        id?: string;
        queueState?: string;
        mode?: string;
      } | null;
      sampledCampaign?: any;
      contextStrength?: string;
      fallbackReason?: string;
      metadata?: any;
      supportedTypes?: Array<{ key: string; label: string; description: string; }>;
    };
  }> {
    return this.http.post<{
      success: boolean;
      message?: string;
      data?: any;
    }>( `${environment.backendURL}/momentum/operator/test-generated-email`, payload );
  }

  runMayaBatch ( payload: {
    tenantId: string;
  } ): Observable<{
    success: boolean;
    message?: string;
    data?: {
      tenantId?: string;
      runId?: string;
      skipped?: boolean;
      reason?: string;
      windowState?: {
        timezone?: string;
        startHour?: number;
      } | null;
      result?: any;
      noonRelease?: { skipped?: boolean; reason?: string; } | null;
      endOfDayReport?: { skipped?: boolean; reason?: string; description?: string; } | null;
    };
  }> {
    return this.http.post<{
      success: boolean;
      message?: string;
      data?: any;
    }>( `${environment.backendURL}/momentum/maya-batches/run`, payload );
  }

  runCustomerMomentumPipeline ( payload: {
    tenantId: string;
    goalAmount?: number;
    customerPipelineStep?: string;
  } ): Observable<{
    success: boolean;
    message?: string;
    data?: any;
  }> {
    const params: Record<string, string> = {
      tenantId: String( payload?.tenantId || '' ).trim()
    };

    if ( Number.isFinite( Number( payload?.goalAmount ) ) && Number( payload?.goalAmount ) > 0 ) {
      params[ 'goalAmount' ] = String( Number( payload.goalAmount ) );
    }

    if ( String( payload?.customerPipelineStep || '' ).trim() ) {
      params[ 'customerPipelineStep' ] = String( payload.customerPipelineStep ).trim();
    }

    return this.http.get<{
      success: boolean;
      message?: string;
      data?: any;
    }>( `${environment.backendURL}/momentum/check`, { params } );
  }

  getMayaDraftingDutyTimePresets ( tenantId: string ): Observable<{
    success: boolean;
    message?: string;
    data?: {
      tenantId?: string;
      timezone?: string;
      startHour?: number;
      rangeStartHour?: number;
      rangeEndHour?: number;
      currentLocalHour?: number;
      presets?: Array<{ key: string; label: string; simulatedNow: string | null; }>;
    };
  }> {
    return this.http.get<{
      success: boolean;
      message?: string;
      data?: any;
    }>( `${environment.backendURL}/momentum/maya-batches/drafting-duty-time-presets`, { params: { tenantId } } );
  }

  runMayaDraftingDuty ( payload: {
    tenantId: string;
    simulatedNow?: string;
    ignoreWindow?: boolean;
  } ): Observable<{
    success: boolean;
    message?: string;
    data?: {
      skipped?: boolean;
      reason?: string;
      runId?: string;
      windowState?: {
        shouldRunNow?: boolean;
        localHour?: number;
        localDateKey?: string;
        rangeStartHour?: number;
        rangeEndHour?: number;
        emailDraftingEnabled?: boolean;
      } | null;
      draftedSoFar?: number;
      totalPlanned?: number;
      chunkSize?: number;
      draftingResult?: any;
    };
  }> {
    return this.http.post<{
      success: boolean;
      message?: string;
      data?: any;
    }>( `${environment.backendURL}/momentum/maya-batches/run-drafting-duty`, payload );
  }

  stopMayaBatch ( payload: {
    tenantId: string;
  } ): Observable<{
    success: boolean;
    message?: string;
    data?: {
      tenantId?: string;
      stopRequested?: boolean;
      requestedAt?: string;
    };
  }> {
    return this.http.post<{
      success: boolean;
      message?: string;
      data?: any;
    }>( `${environment.backendURL}/momentum/maya-batches/stop`, payload );
  }

  getMayaBatchActivity (
    tenantId: string,
    limit: number = 25,
    options?: {
      includeAllStreams?: boolean;
    }
  ): Observable<CockpitActivityItem[]> {
    const params: Record<string, string> = {
      tenantId,
      limit: String( limit )
    };

    if ( options?.includeAllStreams !== true ) {
      params[ 'domains' ] = 'momentum';
      params[ 'surfaces' ] = 'daily-momentum';
    }

    return this.http.get<{ success: boolean; data?: { items?: CockpitActivityItem[]; }; }>(
      `${environment.backendURL}/momentum/cockpit-activity`,
      { params }
    ).pipe(
      map( response => Array.isArray( response?.data?.items ) ? response.data.items : [] )
    );
  }

  getCustomerMomentumActivity (
    tenantId: string,
    limit: number = 50
  ): Observable<CockpitActivityItem[]> {
    const params: Record<string, string> = {
      tenantId,
      limit: String( limit ),
      domains: 'momentum',
      surfaces: 'daily-momentum'
    };

    return this.http.get<{ success: boolean; data?: { items?: CockpitActivityItem[]; }; }>(
      `${environment.backendURL}/momentum/cockpit-activity`,
      { params }
    ).pipe(
      map( response => Array.isArray( response?.data?.items ) ? response.data.items : [] )
    );
  }

  getTenantProvisioning$ ( tenantId: string ): Observable<any | null> {
    return combineLatest( [
      this.getTenant$( tenantId ),
      this.getMomentumApprovalPolicy$( tenantId )
    ] ).pipe(
      map( ( [tenant, approvalPolicy] ) => {
        if ( !tenant && !approvalPolicy ) return null;
        return {
          ...( tenant || {} ),
          autoSendCcEmail: approvalPolicy?.autoSendCcEmail || '',
          dailyDraftTarget: Number( approvalPolicy?.dailyDraftTarget || 100 ) || 100,
          dailyAutoSendTarget: Number( approvalPolicy?.dailyAutoSendTarget || 100 ) || 100
        };
      } )
    );
  }

  getMomentumApprovalPolicy$ ( tenantId: string ): Observable<any | null> {
    const normalizedTenantId = ( tenantId || '' ).trim();
    if ( !normalizedTenantId ) {
      return new Observable( observer => {
        observer.next( null );
        observer.complete();
      } );
    }

    if ( this.isCypressMode() ) {
      this.loadCypressState();
      return this.cypressTenantsSubject.asObservable().pipe(
        map( tenants => tenants[normalizedTenantId]?.momentumApprovalPolicy || null )
      );
    }

    const ref = doc( this.firestore, 'tenants', normalizedTenantId, 'todd-approval-policies', 'daily-momentum' );
    return docData( ref ).pipe(
      map( data => data || null )
    );
  }

  getPendingProvisioningRequests$ (): Observable<any[]> {
    if ( this.isCypressMode() ) {
      this.loadCypressState();
      return this.cypressTenantsSubject.asObservable().pipe(
        map( tenants => Object.entries( tenants )
          .map( ( [id, tenant] ) => ( { id, ...( tenant || {} ) } ) )
          .filter( tenant => ['requested', 'pending', 'manual_review'].includes( String( tenant.outreachProvisioningStatus || '' ).trim().toLowerCase() ) )
        )
      );
    }

    const ref = collection( this.firestore, 'tenants' );
    const pendingQuery = query( ref, where( 'outreachProvisioningStatus', 'in', ['requested', 'pending', 'manual_review'] ) );
    return collectionData( pendingQuery, { idField: 'id' } ).pipe(
      map( rows => Array.isArray( rows ) ? rows : [] )
    );
  }

  async updateMomentumApprovalPolicyConfig ( tenantId: string, payload: {
    autoSendCcEmail?: string;
    dailyDraftTarget?: number | null;
    dailyAutoSendTarget?: number | null;
    updatedAt?: string;
  } ): Promise<void> {
    const normalizedTenantId = ( tenantId || '' ).trim();
    const normalizedCc = String( payload.autoSendCcEmail || '' ).trim().toLowerCase();
    const parsedDraftTarget = Number( payload.dailyDraftTarget );
    const parsedAutoSendTarget = Number( payload.dailyAutoSendTarget );
    const normalizedPayload = {
      autoSendCcEmail: normalizedCc,
      dailyDraftTarget: Number.isFinite( parsedDraftTarget ) && parsedDraftTarget > 0
        ? Math.max( 1, Math.min( 500, Math.floor( parsedDraftTarget ) ) )
        : 100,
      dailyAutoSendTarget: Number.isFinite( parsedAutoSendTarget ) && parsedAutoSendTarget > 0
        ? Math.max( 1, Math.min( 500, Math.floor( parsedAutoSendTarget ) ) )
        : 100,
      updatedAt: String( payload.updatedAt || new Date().toISOString() ).trim()
    };

    if ( this.isCypressMode() ) {
      this.updateCypressTenants( tenants => ( {
        ...tenants,
        [normalizedTenantId]: {
          ...( tenants[normalizedTenantId] || {} ),
          id: normalizedTenantId,
          momentumApprovalPolicy: {
            ...( tenants[normalizedTenantId]?.momentumApprovalPolicy || {} ),
            ...normalizedPayload
          }
        }
      } ) );
      return;
    }

    const ref = doc( this.firestore, 'tenants', normalizedTenantId, 'todd-approval-policies', 'daily-momentum' );
    await setDoc( ref, normalizedPayload, { merge: true } );
  }

  async updateTenantProvisioning ( tenantId: string, payload: {
    outreachProvisioningStatus?: string;
    outreachProvisioningMethod?: string;
    outreachProvisioningMode?: string;
    outreachProvisioningNotes?: string;
    outreachSenderEmail?: string;
    outreachSenderDomain?: string;
    outreachAuthenticatedDomain?: string;
    outreachDomainAuthenticationStatus?: string;
    outreachSendgridDomainAuthId?: string;
    outreachSendgridSenderId?: string;
    outreachSendgridSubuserUsername?: string;
    outreachProvisionedAt?: string | null;
    updatedAt?: string;
  } ): Promise<void> {
    if ( this.isCypressMode() ) {
      this.updateCypressTenants( tenants => ( {
        ...tenants,
        [tenantId]: {
          ...( tenants[tenantId] || {} ),
          id: tenantId,
          ...payload,
        },
      } ) );
      return;
    }

    const normalizedStatus = String( payload.outreachProvisioningStatus || '' ).trim().toLowerCase();
    const normalizedMode = this.normalizeProvisioningMode( payload.outreachProvisioningMode );
    const ref = doc( this.firestore, 'tenants', tenantId );
    await setDoc( ref, {
      ...payload,
      outreachProvisioningMode: normalizedMode,
      outreachAuthenticatedDomain: this.normalizeDomain( payload.outreachAuthenticatedDomain ),
      outreachDomainAuthenticationStatus: this.normalizeDomainAuthenticationStatus(
        payload.outreachDomainAuthenticationStatus,
        normalizedMode
      ),
      outreachSendgridDomainAuthId: String( payload.outreachSendgridDomainAuthId || '' ).trim(),
      outreachSendgridSenderId: String( payload.outreachSendgridSenderId || '' ).trim(),
      outreachSendgridSubuserUsername: String( payload.outreachSendgridSubuserUsername || '' ).trim(),
    }, { merge: true } );

    const normalizedSenderEmail = String( payload.outreachSenderEmail || '' ).trim().toLowerCase();
    const normalizedAuthenticatedDomain = this.normalizeDomain( payload.outreachAuthenticatedDomain );
    const normalizedSenderDomain = this.normalizeDomain( payload.outreachSenderDomain );
    const warmupRef = doc( this.firestore, 'tenants', tenantId, 'emailWarmupState', 'global' );
    await setDoc( warmupRef, {
      senderEmail: normalizedSenderEmail,
      fromEmail: normalizedSenderEmail,
      senderDomain: normalizedAuthenticatedDomain || normalizedSenderDomain,
      lastUpdated: new Date().toISOString(),
    }, { merge: true } );

    if (
      this.shouldSyncManualApprovedSenderContact( normalizedStatus, normalizedMode, normalizedSenderEmail )
    ) {
      await this.syncApprovedSenderContact( tenantId, normalizedSenderEmail );
    }
  }

  private shouldSyncManualApprovedSenderContact ( status: string, mode: string, senderEmail: string ): boolean {
    return ['provisioned', 'active', 'ready'].includes( status ) &&
      mode === 'manual_single_sender' &&
      !!senderEmail;
  }

  private normalizeProvisioningMode ( value?: string ): string {
    const normalized = String( value || '' ).trim().toLowerCase();
    return [
      'manual_single_sender',
      'domain_auth_pending_dns',
      'domain_auth_pending_verification',
      'domain_auth_verified',
      'subuser_domain_auth_verified',
    ].includes( normalized ) ? normalized : 'manual_single_sender';
  }

  private normalizeDomainAuthenticationStatus ( value: string | undefined, mode: string ): string {
    const normalized = String( value || '' ).trim().toLowerCase();
    if ( ['not_started', 'pending_dns', 'pending_verification', 'verified', 'failed'].includes( normalized ) ) {
      return normalized;
    }

    if ( ['domain_auth_verified', 'subuser_domain_auth_verified'].includes( mode ) ) {
      return 'verified';
    }

    if ( mode === 'domain_auth_pending_dns' ) {
      return 'pending_dns';
    }

    if ( mode === 'domain_auth_pending_verification' ) {
      return 'pending_verification';
    }

    return 'not_started';
  }

  private normalizeDomain ( value?: string ): string {
    return String( value || '' ).trim().toLowerCase();
  }

  private async syncApprovedSenderContact ( tenantId: string, senderEmail: string ): Promise<void> {
    const normalizedTenantId = String( tenantId || '' ).trim();
    const normalizedSenderEmail = String( senderEmail || '' ).trim().toLowerCase();

    if ( !normalizedTenantId || !normalizedSenderEmail ) {
      return;
    }

    const contactsRef = collection( this.firestore, `tenants/${normalizedTenantId}/contacts` );
    const senderQuery = query( contactsRef, where( 'email', '==', normalizedSenderEmail ) );
    const senderQuerySnapshot = await getDocs( senderQuery );
    const targetDocRef = senderQuerySnapshot.empty
      ? doc( this.firestore, `tenants/${normalizedTenantId}/contacts/${normalizedTenantId}` )
      : senderQuerySnapshot.docs[0].ref;
    const targetDocSnapshot = await getDoc( targetDocRef );
    const targetContact = targetDocSnapshot.exists() ? targetDocSnapshot.data() as Contact : null;
    const existingEmailAddresses = Array.isArray( targetContact?.emailAddresses ) ? targetContact.emailAddresses : [];
    const updatedAt = new Date().toISOString();
    let matched = false;

    const emailAddresses = existingEmailAddresses.map( address => {
      const currentEmail = String( address?.emailAddress || '' ).trim().toLowerCase();
      if ( currentEmail !== normalizedSenderEmail ) {
        return address;
      }

      matched = true;
      return {
        ...address,
        emailAddress: normalizedSenderEmail,
        emailAddressType: address?.emailAddressType || 'primary',
        checked: true,
        dateChecked: updatedAt,
        blocked: false,
      };
    } );

    if ( !matched ) {
      emailAddresses.push( {
        emailAddress: normalizedSenderEmail,
        emailAddressType: 'primary',
        checked: true,
        dateChecked: updatedAt,
        blocked: false,
      } as any );
    }

    await setDoc( targetDocRef, {
      id: targetContact?.id || targetDocRef.id,
      tenantId: targetContact?.tenantId || normalizedTenantId,
      email: normalizedSenderEmail,
      emailAddresses,
      updatedAt,
    }, { merge: true } );
  }

  // ---- GRADING WEIGHTS ----

  getGradingWeights$ (): Observable<GradingWeights> {
    if ( this.isCypressMode() ) {
      this.loadCypressState();
      return this.cypressWeightsSubject.asObservable();
    }

    const ref = doc( this.firestore, 'config', 'gradingWeights' );
    return docData( ref ).pipe(
      map( ( data ) => {
        if ( !data || Object.keys( data ).length === 0 ) {
          return DEFAULT_WEIGHTS;
        }
        return {
          ...DEFAULT_WEIGHTS,
          ...data,
        } as GradingWeights;
      } )
    );
  }

  async saveGradingWeights ( weights: GradingWeights ): Promise<void> {
    if ( this.isCypressMode() ) {
      this.loadCypressState();
      this.cypressWeightsSubject.next( weights );
      this.persistCypressState();
      return;
    }

    const ref = doc( this.firestore, 'config', 'gradingWeights' );
    await setDoc( ref, weights, { merge: true } );
  }

  async resetGradingWeights (): Promise<GradingWeights> {
    if ( this.isCypressMode() ) {
      this.loadCypressState();
      this.cypressWeightsSubject.next( DEFAULT_WEIGHTS );
      this.persistCypressState();
      return DEFAULT_WEIGHTS;
    }

    const ref = doc( this.firestore, 'config', 'gradingWeights' );
    await setDoc( ref, DEFAULT_WEIGHTS );
    return DEFAULT_WEIGHTS;
  }

  // convenience if you ever want a one-shot load
  async getGradingWeightsOnce (): Promise<GradingWeights> {
    return await firstValueFrom( this.getGradingWeights$() );
  }

  private async getUserById ( userId: string ): Promise<AppUser | null> {
    const users = await firstValueFrom( this.getUsers$() );
    return users.find( user => user.id === userId ) || null;
  }

  private toTenantMember ( user: AppUser ): AppUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName || user.email,
      role: user.role,
      companyId: user.companyId,
      status: user.status,
      isTenantOwner: !!user.isTenantOwner,
    };
  }

  private toTenantOwnerUser ( contact: Contact | null, tenantId: string ): AppUser | null {
    if ( !contact ) {
      return null;
    }

    const email = String(
      contact.email
      || contact.emailAddresses?.[0]?.emailAddress
      || ''
    ).trim().toLowerCase();

    if ( !email ) {
      return null;
    }

    const displayName = String(
      contact.displayName
      || [contact.firstName, contact.lastName].filter( Boolean ).join( ' ' )
      || email
    ).trim();

    return {
      id: String( contact.id || contact.uid || contact.loginID || tenantId ).trim(),
      email,
      displayName,
      role: 'admin',
      companyId: tenantId,
      status: 'active',
      isTenantOwner: true,
    };
  }
}
