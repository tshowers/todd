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

// Every entry is a real navigable destination (top-level route or an
// in-page tab reached via a query param). Keywords are plain-language
// synonyms a user might type instead of the on-screen label, so typing
// "relationships" or "contacts" still finds Network, "operator controls"
// still finds the Daily Momentum operator tab, etc.
//
// Deliberately excluded from this index: routes under app.routes.ts /
// email.routes.ts / social.routes.ts / lead-vault.routes.ts
// that are (a) error/exception pages (page-not-found, error, bad-request,
// not-authorized, login-error, sign-up-error), (b) the 'vikki' redirect,
// (c) pure redirect aliases with no destination of their own (e.g. 'today',
// 'docs', 'pulse', 'user-profile' - their target is already indexed under
// its canonical path), (d) auth/OAuth callback landing pages that only work
// when reached via a real email link or continue-URL (finish-sign-in,
// finish-waitlist, finish-affiliate-sign-in, finish-affiliate-sign-up), and
// (e) routes that require an existing record id with no generic target
// (contact/:id, post/:id, move/:id, document-editor/:id, survey-view/:id,
// take-survey/:id, survey-dashboard/:surveyId, business/:identifier,
// response-flow/:id, lead-vault record/:id and full/:id) - and the
// post-checkout success pages (*/success), which only render meaningfully
// right after a real Stripe checkout completes.
export const COMMAND_PALETTE_ENTRIES: CommandPaletteEntry[] = [
  // --- Home -------------------------------------------------------------
  { id: 'ask-todd', label: 'Ask TODD', group: 'Home', path: '/ask-todd', keywords: ['ask todd', 'chat', 'assistant', 'help', 'today'] },
  { id: 'app-dashboard', label: 'Dashboard', group: 'Home', path: '/app-dashboard', keywords: ['dashboard', 'overview'] },
  { id: 'daily-momentum-main', label: 'Daily Momentum', group: 'Home', path: '/daily-momentum', keywords: ['daily momentum', 'today', 'main', 'momentum'] },
  { id: 'homepage', label: 'Homepage', group: 'Home', path: '/', icon: '/assets/TODD-icon.png', keywords: ['homepage', 'landing page', 'welcome page'] },
  { id: 'proof', label: 'The Research Behind TODD', group: 'Home', path: '/proof', keywords: ['proof', 'research', 'evidence', 'why todd works'] },
  { id: 'products', label: 'Free Tools Overview', group: 'Home', path: '/products', keywords: ['products', 'free tools', 'free products page'] },
  { id: 'pricing', label: 'Enterprise Pricing', group: 'Home', path: '/pricing', keywords: ['pricing', 'plans', 'cost', 'subscription plans', 'enterprise pricing', 'enterprise plans'] },
  { id: 'suite-pricing', label: 'Suite Pricing', group: 'Home', path: '/suite/pricing', keywords: ['suite pricing', 'bundle pricing', 'all-in-one plan'] },
  { id: 'help', label: 'Help', group: 'Home', path: '/help', keywords: ['help', 'faq', 'support', 'basic help'] },
  { id: 'api-docs', label: 'API Docs', group: 'Home', path: '/api-docs', keywords: ['api docs', 'developer docs', 'api documentation'] },
  { id: 'help-wanted', label: 'Careers', group: 'Home', path: '/help-wanted', keywords: ['careers', 'jobs', 'help wanted', 'hiring'] },

  // --- Daily Momentum -----------------------------------------------------
  { id: 'daily-momentum-live-feed', label: 'Live Feed', group: 'Daily Momentum', path: '/daily-momentum', queryParams: { tab: 'live-feed' }, keywords: ['live feed', 'activity', 'feed', 'updates'] },
  { id: 'daily-momentum-operator', label: 'Operator Controls', group: 'Daily Momentum', path: '/daily-momentum', queryParams: { tab: 'operator' }, keywords: ['operator controls', 'controls', 'operator', 'automation controls', 'tuning'] },
  { id: 'daily-momentum-status', label: 'Live Status', group: 'Daily Momentum', path: '/daily-momentum', queryParams: { tab: 'status' }, keywords: ['live status', 'status', 'health', 'system status'] },
  { id: 'daily-momentum-customer', label: 'Customer Momentum', group: 'Daily Momentum', path: '/daily-momentum/customer-momentum', keywords: ['customer momentum', 'client momentum', 'customers'] },
  { id: 'momentum-receipts', label: 'Momentum Receipts', group: 'Daily Momentum', path: '/momentum-receipts', keywords: ['receipts', 'proof', 'momentum receipts'] },

  // --- Network --------------------------------------------------------
  { id: 'network-home', label: 'Network', group: 'Network', path: '/network/app', keywords: ['contacts', 'relationships', 'people', 'crm', 'address book', 'connections', 'network'] },
  { id: 'contact-list', label: 'Contact List', group: 'Network', path: '/contact-list', keywords: ['contact list', 'all contacts', 'contacts'] },
  { id: 'contact-import', label: 'Import Contacts', group: 'Network', path: '/contact-import', keywords: ['import contacts', 'upload contacts', 'csv import'] },
  { id: 'contact-edit', label: 'Add Contact', group: 'Network', path: '/contact-edit', keywords: ['add contact', 'new contact', 'create contact'] },
  { id: 'contact-deal-flow', label: 'Pipeline', group: 'Network', path: '/contact-deal-flow', keywords: ['pipeline', 'deal flow', 'sales pipeline'] },
  { id: 'contact-notes', label: 'Contact Notes', group: 'Network', path: '/notes', keywords: ['contact notes', 'notes'] },
  { id: 'attach-document', label: 'Attach Document', group: 'Network', path: '/upload', keywords: ['attach document', 'upload to contact'] },
  { id: 'match-maker', label: 'Match Maker', group: 'Network', path: '/match-maker', keywords: ['match maker', 'matching', 'referral matches'] },
  { id: 'lead-vault', label: 'Lead Vault', group: 'Network', path: '/lead-vault', icon: '/assets/lead-vault/lead-vault.png', keywords: ['lead vault', 'leads', 'purchased leads', 'buy leads'] },
  { id: 'network-pricing', label: 'Network Pricing', group: 'Network', path: '/network/pricing', keywords: ['network pricing'] },

  // --- Outreach ---------------------------------------------------------
  { id: 'outreach-home', label: 'Outreach', group: 'Outreach', path: '/outreach/app', keywords: ['outreach', 'campaigns', 'sequences', 'email marketing', 'prospecting'] },
  { id: 'compose-email', label: 'Compose Email', group: 'Outreach', path: '/compose-email', keywords: ['compose email', 'new email', 'write email'] },
  { id: 'inbox-access', label: 'Inbox Access', group: 'Outreach', path: '/inbox-access', keywords: ['inbox access', 'connect inbox', 'connect email account'] },
  // On-screen tab label is "Catalyst" (nav-config.service.ts's outreach page
  // actions call this route that too) - kept the "Email Processing" label
  // since that's still this page's own heading, but catalyst has to be a
  // keyword or searching the name printed on the tab finds nothing.
  { id: 'email-processor', label: 'Email Processing', group: 'Outreach', path: '/email-processor', keywords: ['email processing', 'catalyst'] },
  { id: 'outreach-engagement', label: 'Email Engagement', group: 'Outreach', path: '/engagement', keywords: ['email engagement', 'opens', 'clicks', 'engagement tracking'] },
  { id: 'outreach-pricing', label: 'Outreach Pricing', group: 'Outreach', path: '/outreach/pricing', keywords: ['outreach pricing'] },

  // --- Signal Engine ------------------------------------------------------
  { id: 'signal-engine-drafts', label: 'Drafts', group: 'Signal Engine', path: '/signal-engine', queryParams: { tab: 'drafts' }, keywords: ['drafts', 'maya drafts', 'pending emails'] },
  { id: 'signal-engine-outbox', label: 'Outbox', group: 'Signal Engine', path: '/signal-engine', queryParams: { tab: 'outbox' }, keywords: ['outbox', 'sending queue', 'send queue'] },
  { id: 'signal-engine-sent', label: 'Sent', group: 'Signal Engine', path: '/signal-engine', queryParams: { tab: 'sent' }, keywords: ['sent emails', 'sent history'] },
  { id: 'signal-engine-plan', label: 'Plan', group: 'Signal Engine', path: '/signal-engine', queryParams: { tab: 'plan' }, keywords: ['plan', 'outreach plan', 'outreach strategy'] },

  // --- Social (the BMS Social system - social media outreach automation,
  // lives under /outreach/social/*) ----------------------------------------
  { id: 'social-command', label: 'Social', group: 'Social', path: '/outreach/social/command', keywords: ['social', 'social command', 'social outreach', 'social media management'] },
  { id: 'social-accounts', label: 'Social Accounts', group: 'Social', path: '/outreach/social/accounts', keywords: ['social accounts', 'connect social accounts'] },
  { id: 'social-queue', label: 'Social Queue', group: 'Social', path: '/outreach/social/queue', keywords: ['social queue', 'approved posts', 'social approved'] },
  { id: 'social-strategy', label: 'Social Strategy', group: 'Social', path: '/outreach/social/strategy', keywords: ['social strategy'] },
  { id: 'social-calendar', label: 'Social Calendar', group: 'Social', path: '/outreach/social/calendar', keywords: ['social calendar', 'content calendar'] },

  // --- Moves --------------------------------------------------------------
  { id: 'moves-home', label: 'Moves', group: 'Moves', path: '/moves/app', keywords: ['moves', 'tasks', 'projects', 'to-dos', 'action items', 'task home'] },
  { id: 'moves-view', label: 'Moves View', group: 'Moves', path: '/moves-view', keywords: ['moves view', 'task view', 'tasks'] },
  { id: 'ai-missions', label: 'AI Missions', group: 'Moves', path: '/moves/ai-missions', keywords: ['ai missions', 'automated tasks', 'missions'] },
  { id: 'new-task', label: 'New Task', group: 'Moves', path: '/move', keywords: ['new task', 'create task', 'add task'] },
  { id: 'mission', label: 'Mission Mode', group: 'Moves', path: '/mission', keywords: ['mission mode', 'mission', 'project plan', 'deliver a project'] },
  { id: 'moves-pricing', label: 'Moves Pricing', group: 'Moves', path: '/moves/pricing', keywords: ['moves pricing'] },

  // --- Docs -----------------------------------------------------------
  { id: 'docs-home', label: 'Docs', group: 'Docs', path: '/docs/app', keywords: ['docs', 'documents', 'files', 'proposals', 'contracts'] },
  { id: 'documents', label: 'Documents', group: 'Docs', path: '/documents', keywords: ['documents', 'document list', 'all documents'] },
  { id: 'document-upload', label: 'Upload Document', group: 'Docs', path: '/document', keywords: ['upload document', 'add document'] },
  { id: 'knowledge-base', label: 'Knowledge Base', group: 'Docs', path: '/knowledge-base', keywords: ['knowledge base', 'wiki', 'repository'] },
  { id: 'document-editor', label: 'Document Editor', group: 'Docs', path: '/document-editor', keywords: ['document editor', 'new document', 'write document'] },
  { id: 'response-flow', label: 'Response Flow', group: 'Docs', path: '/response-flow', keywords: ['response flow'] },
  { id: 'proposal-history', label: 'Proposal History', group: 'Docs', path: '/proposal-history', keywords: ['proposal history', 'proposals'] },
  { id: 'rfp-list', label: 'RFPs', group: 'Docs', path: '/rfp-list', keywords: ['rfp list', 'request for proposals', 'rfps'] },
  { id: 'rfp-upload', label: 'RFP Upload', group: 'Docs', path: '/rfp-upload', keywords: ['rfp upload', 'request for proposal', 'rfp'] },
  { id: 'docs-pricing', label: 'Docs Pricing', group: 'Docs', path: '/docs/pricing', keywords: ['docs pricing'] },
  { id: 'knowledge-pricing', label: 'Knowledge Pricing', group: 'Docs', path: '/knowledge/pricing', keywords: ['knowledge pricing'] },

  // --- Pulse ------------------------------------------------------------
  { id: 'pulse-home', label: 'Pulse', group: 'Pulse', path: '/pulse/app', keywords: ['pulse', 'surveys', 'feedback', 'nps', 'forms'] },
  { id: 'survey-list', label: 'Surveys', group: 'Pulse', path: '/survey-list', keywords: ['surveys', 'survey list'] },
  { id: 'survey-edit', label: 'New Pulse', group: 'Pulse', path: '/survey-edit', keywords: ['new survey', 'create survey', 'pulse edit'] },
  { id: 'pulse-pricing', label: 'Pulse Pricing', group: 'Pulse', path: '/pulse/pricing', keywords: ['pulse pricing'] },

  // --- Admin ------------------------------------------------------------
  { id: 'admin-users', label: 'Users', group: 'Admin', path: '/admin', queryParams: { tab: 'users' }, keywords: ['admin users', 'user accounts'] },
  { id: 'admin-profiles', label: 'Profile Approvals', group: 'Admin', path: '/admin', queryParams: { tab: 'profiles' }, keywords: ['profile approvals', 'approve profiles'] },
  { id: 'admin-provisioning', label: 'Outreach Provisioning', group: 'Admin', path: '/admin', queryParams: { tab: 'provisioning' }, keywords: ['provisioning', 'sender setup', 'domain authentication'] },
  { id: 'admin-team', label: 'Team', group: 'Admin', path: '/admin', queryParams: { tab: 'team' }, keywords: ['team', 'team members'] },
  { id: 'admin-weights', label: 'Grading Weights', group: 'Admin', path: '/admin', queryParams: { tab: 'weights' }, keywords: ['grading weights', 'scoring weights'] },
  { id: 'admin-maya', label: 'Maya', group: 'Admin', path: '/admin', queryParams: { tab: 'maya' }, keywords: ['maya', 'run maya', 'maya batch'] },
  { id: 'admin-momentum', label: 'Momentum Check', group: 'Admin', path: '/admin', queryParams: { tab: 'momentum' }, keywords: ['momentum check', 'run momentum check'] },
  { id: 'admin-pipeline', label: 'Pipeline', group: 'Admin', path: '/admin', queryParams: { tab: 'pipeline' }, keywords: ['pipeline', 'customer pipeline'] },
  { id: 'admin-sayit', label: 'SayIt Admin', group: 'Admin', path: '/admin', queryParams: { tab: 'sayit' }, keywords: ['sayit invite', 'sayit testing'] },

  // --- Settings -----------------------------------------------------------
  { id: 'billing', label: 'Billing', group: 'Settings', path: '/billing', keywords: ['billing', 'subscription', 'invoice', 'payment'] },
  { id: 'settings', label: 'Settings', group: 'Settings', path: '/settings', keywords: ['settings', 'preferences'] },
  { id: 'update-profile', label: 'Update Profile', group: 'Settings', path: '/update-profile', keywords: ['my profile', 'update profile', 'my account', 'user profile'] },
  { id: 'dropdown-manager', label: 'Dropdown Manager', group: 'Settings', path: '/dropdown-manager', keywords: ['dropdown manager', 'custom fields', 'dropdown options'] },

  // --- Account ------------------------------------------------------------
  { id: 'login', label: 'Login', group: 'Account', path: '/login', keywords: ['login', 'sign in'] },
  { id: 'logout', label: 'Logout', group: 'Account', path: '/logout', keywords: ['logout', 'sign out'] },
  { id: 'forgot-password', label: 'Forgot Password', group: 'Account', path: '/forgot-password', keywords: ['forgot password', 'reset password'] },

  // --- Legal --------------------------------------------------------------
  { id: 'terms-and-conditions', label: 'Terms and Conditions', group: 'Legal', path: '/terms-and-conditions', keywords: ['terms', 'terms and conditions', 'tos'] },
  { id: 'privacy-policy', label: 'Privacy Policy', group: 'Legal', path: '/privacy-policy', keywords: ['privacy policy', 'privacy'] },
  { id: 'privacy-rights', label: 'Privacy Rights Request', group: 'Legal', path: '/privacy-rights', keywords: ['privacy rights', 'ccpa', 'data request', 'right to know'] },

  // --- Investor Relations ---------------------------------------------------
  { id: 'investor-relations', label: 'Investor Relations', group: 'Investor Relations', path: '/investor-relations', keywords: ['investor relations', 'investors'] },
  { id: 'investment-overview', label: 'Investor Overview', group: 'Investor Relations', path: '/investment-overview', keywords: ['investment overview', 'investor deck', 'pitch deck'] },

  // --- Affiliates -----------------------------------------------------------
  { id: 'affiliates', label: 'Affiliates', group: 'Affiliates', path: '/affiliates', keywords: ['affiliates', 'affiliate program', 'reseller'] },
  { id: 'affiliate-sign-in', label: 'Affiliate Sign In', group: 'Affiliates', path: '/affiliate-sign-in', keywords: ['affiliate sign in', 'affiliate login'] },
  { id: 'affiliate-settings', label: 'Affiliate Settings', group: 'Affiliates', path: '/affiliate-settings', keywords: ['affiliate settings'] },
  { id: 'affiliate-dashboard', label: 'Affiliate Dashboard', group: 'Affiliates', path: '/affiliate-dashboard', keywords: ['affiliate dashboard'] },
  { id: 'affiliate-overview', label: 'Affiliate Overview', group: 'Affiliates', path: '/affiliate-overview', keywords: ['affiliate overview'] },
  { id: 'affiliate-signup', label: 'Affiliate Signup', group: 'Affiliates', path: '/affiliate-signup', keywords: ['affiliate signup', 'become an affiliate'] },
  { id: 'program-materials', label: 'Program Materials', group: 'Affiliates', path: '/program-materials', keywords: ['program materials', 'affiliate resources'] },
  { id: 'affiliate-terms-conditions', label: 'Affiliate Terms and Conditions', group: 'Affiliates', path: '/affiliate-terms-conditions', keywords: ['affiliate terms'] },
  { id: 'affiliate-logout', label: 'Affiliate Logout', group: 'Affiliates', path: '/affiliate-logout', keywords: ['affiliate logout'] },

  // --- Free Tools (also surfaced on the public /products page) ------------
  { id: 'meet-maya', label: 'Meet Maya', group: 'Free Tools', path: 'https://maya.taliferro.tech', icon: '/assets/marketing/marketing-director-avatar.png', external: true, keywords: ['meet maya', 'talk to maya', 'marketing director', 'marketing advice'] },
  { id: 'email-signature-builder', label: 'Email Signature Builder', group: 'Free Tools', path: 'https://signature.taliferro.tech', icon: '/assets/outreach/email-signature-builder.png', external: true, keywords: ['email signature', 'signature builder'] },
  { id: 'find', label: 'Find', group: 'Free Tools', path: 'https://find.taliferro.tech', icon: '/assets/find-logo.png', external: true, keywords: ['find', 'ask a question', 'one strong result'] },
  { id: 'sayit-public', label: 'SayIt', group: 'Free Tools', path: 'https://sayit.taliferro.tech', icon: '/assets/sayit/sayit-logo.png', external: true, keywords: ['join sayit', 'sayit', 'say it', 'social media for organizations'] },
  { id: 'taliferro-music', label: 'Taliferro Music', group: 'Free Tools', path: 'https://music.taliferro.com', icon: '/assets/taliferro-music.jpg', external: true, newTab: true, keywords: ['taliferro music', 'music', 'stream music'] },
];
