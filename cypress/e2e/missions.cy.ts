/**
 * Missions in Ask TODD (design_handoff_todd_missions 1a-1d, 10a, 14a).
 * Fixtures come from todd-backend scripts/missions-fixtures.js (the real
 * engine). Regenerate them after changing the engine or the examples:
 *   cd taliferrotech/todd-backend/functions && node scripts/missions-fixtures.js
 */
const ME = { uid: 'uid-owner', tenantId: 'tenant-1', paid: true };
const MISSIONS = '**/api/orchestration/missions';

function stubApi () {
  cy.intercept( { url: '**/api/**' }, { statusCode: 200, body: { success: true } } );
}

/** POST a request -> a queued Mission -> polled until it's the given fixture. */
function planned ( fixture: string, id = 'reach-named-person' ) {
  cy.fixture( `missions/${fixture}.json` ).then( ( m ) => {
    cy.intercept( 'POST', MISSIONS, { statusCode: 202, body: { success: true, mode: 'mission', mission: { ...m, id, status: 'queued', steps: [] } } } ).as( 'ask' );
    cy.intercept( 'GET', `${MISSIONS}/${id}`, { success: true, mission: { ...m, id } } ).as( 'get' );
  } );
}

describe( 'Plan reply (1a-1d, 10a)', () => {
  beforeEach( stubApi );

  it( 'a request that needs a plan: who does what, what needs you, then Start', () => {
    planned( 'roland-proposed' );
    cy.intercept( 'POST', `${MISSIONS}/reach-named-person/start`, { statusCode: 202, body: { success: true, mission: { id: 'reach-named-person', status: 'queued', steps: [] } } } ).as( 'start' );
    cy.visitWithCypressAuth( '/missions', ME );
    cy.get( '[data-cy="ask-input"]' ).type( 'Create an email I can send to Roland Martin.' );
    cy.get( '[data-cy="ask-send"]' ).click();
    cy.wait( '@ask' ).its( 'request.body' ).should( 'include', { request: 'Create an email I can send to Roland Martin.', origin: 'ask' } );
    cy.get( '[data-cy="ask-bubble"]' ).should( 'contain.text', 'Roland Martin' );
    cy.get( '[data-cy="plan-card"]' ).should( 'be.visible' );
    cy.get( '[data-cy="plan-title"]' ).should( 'contain.text', 'Reach a named person' );
    cy.get( '[data-cy="fact-approvals"]' ).should( 'have.text', '1 approval from you' );
    cy.get( '[data-cy="fact-time"]' ).should( 'have.text', 'About 3 min of your time' );
    cy.get( '[data-cy="plan-split"]' ).should( 'contain.text', 'by TODD' ).and( 'contain.text', 'by Maya' ).and( 'contain.text', 'by you' );
    cy.get( '[data-cy="plan-strip-full"]' ).should( 'exist' );
    cy.get( '[data-cy="plan-start"]' ).click();
    cy.wait( '@start' );
    cy.get( '[data-cy="started"]' ).should( 'contain.text', 'Started' ).find( 'a' ).should( 'have.attr', 'href', 'https://moves.taliferro.tech/missions/reach-named-person' );
  } );

  it( 'shows “Planning…” with what TODD is doing while it plans', () => {
    cy.fixture( 'missions/planning.json' ).then( ( m ) => {
      cy.intercept( 'POST', MISSIONS, { statusCode: 202, body: { success: true, mode: 'mission', mission: { ...m, id: 'p1' } } } );
      cy.intercept( 'GET', `${MISSIONS}/p1`, { success: true, mission: { ...m, id: 'p1' } } );
    } );
    cy.visitWithCypressAuth( '/missions', ME );
    cy.get( '[data-cy="ask-input"]' ).type( 'Email Roland Martin' );
    cy.get( '[data-cy="ask-send"]' ).click();
    cy.get( '[data-cy="planning"]' ).should( 'contain.text', 'Planning…' ).and( 'contain.text', 'Checking Network for Roland Martin' );
  } );

  it( 'a simple question is answered on the spot, no Mission', () => {
    cy.fixture( 'missions/direct.json' ).then( ( body ) => cy.intercept( 'POST', MISSIONS, body ).as( 'ask' ) );
    cy.visitWithCypressAuth( '/missions', ME );
    cy.get( '[data-cy="ask-input"]' ).type( 'What’s Roland Martin’s email?' );
    cy.get( '[data-cy="ask-send"]' ).click();
    cy.get( '[data-cy="direct-answer"]' ).should( 'contain.text', 'roland.martin@caldersystems.com' ).and( 'contain.text', 'Network' ).and( 'contain.text', 'Answered here. No Mission.' );
    cy.get( '[data-cy="plan-card"]' ).should( 'not.exist' );
  } );

  it( 'planning failed: it becomes a “Plan this” task for you, never nothing', () => {
    planned( 'planning-failed', 'denver' );
    cy.visitWithCypressAuth( '/missions', ME );
    cy.get( '[data-cy="ask-input"]' ).type( 'Sort out the Denver thing' );
    cy.get( '[data-cy="ask-send"]' ).click();
    cy.get( '[data-cy="plan-summary"]' ).should( 'contain.text', 'Nothing in Moves, Docs or Network mentions' );
    cy.get( '[data-cy="plan-card"]' ).should( 'contain.text', 'Plan this' );
    cy.get( '[data-cy="tell-more"]' ).should( 'be.visible' );
    cy.get( '[data-cy="plan-myself"]' ).should( 'be.visible' );
    cy.get( '[data-cy="tell-more"]' ).click();
    cy.get( '[data-cy="ask-input"]' ).should( 'have.value', 'Sort out the Denver thing' );
  } );

  it( 'when TODD needs an answer first, it asks, then plans', () => {
    cy.fixture( 'missions/roland-proposed.json' ).then( ( m ) => {
      cy.intercept( 'POST', MISSIONS, { statusCode: 202, body: { success: true, mode: 'mission', mission: { ...m, status: 'queued', steps: [] } } } );
      let answered = false;
      cy.intercept( 'GET', `${MISSIONS}/reach-named-person`, ( req ) => req.reply( { success: true, mission: answered ? m : { ...m, status: 'awaiting_user', steps: [], questions: ['Which Roland Martin: the journalist or the Calder Systems VP?'] } } ) );
      cy.intercept( 'POST', `${MISSIONS}/reach-named-person/answers`, ( req ) => {
        answered = true;
        req.reply( { statusCode: 202, body: { success: true, mission: { ...m, status: 'queued' } } } );
      } ).as( 'answers' );
    } );
    cy.visitWithCypressAuth( '/missions', ME );
    cy.get( '[data-cy="ask-input"]' ).type( 'Email Roland Martin' );
    cy.get( '[data-cy="ask-send"]' ).click();
    cy.get( '[data-cy="planner-questions"]' ).should( 'contain.text', 'the journalist or the Calder Systems VP' );
    cy.get( '[data-cy="question-0"]' ).type( 'The Calder Systems VP' );
    cy.get( '[data-cy="answer-questions"]' ).click();
    cy.wait( '@answers' ).its( 'request.body.answers.0.answer' ).should( 'eq', 'The Calder Systems VP' );
    cy.get( '[data-cy="plan-card"]' ).should( 'be.visible' );
  } );

  it( 'signed out: asks you to sign in', () => {
    cy.visit( '/missions' );
    cy.get( '[data-cy="missions-signin"]' ).should( 'contain.text', 'Sign in' );
  } );
} );

describe( 'Playbooks (14a)', () => {
  beforeEach( () => {
    stubApi();
    cy.fixture( 'missions/playbooks.json' ).then( ( body ) => cy.intercept( 'GET', `${MISSIONS}/playbooks`, body ).as( 'playbooks' ) );
  } );

  it( 'by what you want to do, filtered by app', () => {
    cy.visitWithCypressAuth( '/playbooks', ME );
    cy.get( '[data-cy="playbook-card"]' ).should( 'have.length.greaterThan', 40 );
    cy.get( '[data-cy="cat-bids"]' ).click();
    cy.get( '[data-cy="playbooks-title"]' ).should( 'have.text', 'Bids and proposals' );
    cy.get( '[data-cy="playbook-card"]' ).each( ( card ) => cy.wrap( card ).should( 'not.contain.text', 'Weekly status' ) );
    cy.get( '[data-cy="app-pulse"]' ).click();
    cy.get( '[data-cy="playbook-card"]' ).should( 'have.length.greaterThan', 0 ).first().should( 'contain.text', 'Pulse' );
    cy.get( '[data-cy="app-pulse"]' ).click();
    cy.get( '[data-cy="cat-contacts"]' ).click();
    cy.get( '[data-cy="playbooks-empty"]' ).should( 'contain.text', 'No playbooks use Pulse in this category.' );
  } );

  it( 'search narrows the list', () => {
    cy.visitWithCypressAuth( '/playbooks', ME );
    cy.get( '[data-cy="playbooks-search"]' ).type( 'webinar' );
    cy.get( '[data-cy="playbook-card"]' ).should( 'have.length', 1 ).and( 'contain.text', 'Launch a webinar' );
  } );

  it( '“Use this” plans it for you', () => {
    planned( 'roland-proposed' );
    cy.visitWithCypressAuth( '/playbooks', ME );
    cy.get( '[data-cy="playbook-card"][data-id="reach-named-person"] [data-cy="playbook-use"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/missions' );
    cy.wait( '@ask' ).its( 'request.body' ).should( 'include', { origin: 'playbook', playbookId: 'reach-named-person', force: 'mission' } );
    cy.get( '[data-cy="plan-card"]' ).should( 'be.visible' );
  } );
} );

describe( 'Email an industry segment (one personalized email to a whole audience)', () => {
  const VC = 'Send a personalized email to all the venture capital and finance people in my contacts and Lead Vault asking if they’re interested in investing.';

  beforeEach( () => {
    stubApi();
    cy.fixture( 'missions/playbooks.json' ).then( ( body ) => cy.intercept( 'GET', `${MISSIONS}/playbooks`, body ) );
  } );

  it( 'asking for it gets the plan: Network and Lead Vault, research, your shortlist, Maya’s email, one approval, the batch send', () => {
    planned( 'segment-proposed', 'pitch-segment' );
    cy.intercept( 'POST', `${MISSIONS}/pitch-segment/start`, { statusCode: 202, body: { success: true, mission: { id: 'pitch-segment', status: 'queued', steps: [] } } } ).as( 'start' );
    cy.visitWithCypressAuth( '/missions', ME );
    cy.get( '[data-cy="ask-input"]' ).type( VC );
    cy.get( '[data-cy="ask-send"]' ).click();
    cy.wait( '@ask' ).its( 'request.body' ).should( 'include', { request: VC, origin: 'ask' } );
    cy.get( '[data-cy="plan-title"]' ).should( 'contain.text', 'Email an industry segment' );
    cy.get( '[data-cy="fact-approvals"]' ).should( 'have.text', '1 approval from you' );
    cy.get( '[data-cy="fact-time"]' ).should( 'have.text', 'About 25 min of your time' );
    cy.get( '[data-cy="plan-split"]' ).should( 'contain.text', 'by TODD' ).and( 'contain.text', 'by Maya' ).and( 'contain.text', 'by you' );
    cy.get( '[data-cy="plan-card"]' )
      .should( 'contain.text', 'Find venture capital and finance people in your Network' )
      .and( 'contain.text', 'Keep or drop each one' )
      .and( 'contain.text', 'Approve the batch' );
    cy.get( '[data-cy="plan-start"]' ).click();
    cy.wait( '@start' );
  } );

  it( 'it’s a playbook you can find and use for any industry', () => {
    planned( 'segment-proposed', 'pitch-segment' );
    cy.visitWithCypressAuth( '/playbooks', ME );
    cy.get( '[data-cy="playbooks-search"]' ).type( 'industry segment' );
    cy.get( '[data-cy="playbook-card"]' ).should( 'have.length', 1 ).and( 'contain.text', 'Email an industry segment' );
    cy.get( '[data-cy="playbook-card"][data-id="pitch-segment"] [data-cy="playbook-use"]' ).click();
    cy.wait( '@ask' ).its( 'request.body' ).should( 'include', { origin: 'playbook', playbookId: 'pitch-segment', force: 'mission' } );
    cy.get( '[data-cy="plan-title"]' ).should( 'contain.text', 'Email an industry segment' );
  } );
} );

describe( 'Ty’s requests, each from a playbook to its plan (the real engine’s plans)', () => {
  beforeEach( () => {
    stubApi();
    cy.fixture( 'missions/playbooks.json' ).then( ( body ) => cy.intercept( 'GET', `${MISSIONS}/playbooks`, body ) );
  } );

  it( 'every request gets a plan card with owners, a strip and Start', () => {
    cy.fixture( 'missions/ty-ids.json' ).then( ( ids: string[] ) => {
      cy.fixture( 'missions/examples-proposed.json' ).then( ( proposed ) => {
        ids.forEach( ( id ) => {
          cy.intercept( 'POST', MISSIONS, { statusCode: 202, body: { success: true, mode: 'mission', mission: { ...proposed[id], status: 'queued', steps: [] } } } );
          cy.intercept( 'GET', `${MISSIONS}/${id}`, { success: true, mission: proposed[id] } );
          cy.visitWithCypressAuth( `/playbooks`, ME );
          cy.get( `[data-cy="playbook-card"][data-id="${id}"] [data-cy="playbook-use"]` ).click();
          cy.get( '[data-cy="plan-title"]' ).should( 'contain.text', proposed[id].title );
          cy.get( '[data-cy="plan-split"]' ).should( 'contain.text', 'by TODD' );
          cy.get( '[data-cy="plan-start"]' ).should( 'be.visible' );
        } );
      } );
    } );
  } );
} );
