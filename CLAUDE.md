# Ask TODD — migration context

This app is the standalone extraction target for TODD's chat/home page
(`ToddComponent`), currently still live at `todd.taliferro.tech/ask-todd`
in the main `taliferrotech` repo. It follows the same playbook already
used for Maya, Find, SayIt, Email Signature Builder, Lead Vault, Network,
and Pulse: its own git repo, same Firebase project (`taliferrotech`) and
backend (`api.taliferro.tech`), own Firebase Hosting site (`ask-todd`,
custom domain `ask.taliferro.tech`).

If you're picking this up in a fresh session: read this whole file first,
then `README.md` for the day-to-day dev commands.

## Status: Phase 1 and Phase 2 done (uncommitted here); Phase 3 (main-app shim) mostly done (uncommitted in taliferrotech/frontend) — deletion step deferred

**Phase 1 (scaffold) — done, commit `4bb900a`:**
- Forked from `web-products/maya-marketing` rather than built from
  scratch, since it already carries almost the entire shared service
  graph `ToddComponent` needs (`GoalService`, `AssistantCapabilitiesService`,
  `ToddActivationStateService`, `AssistantComposerFlowService`,
  `ToddAssistantBusService`, `AuthService`, `UserService`, `ContactService`,
  etc.).
- Removed Maya's own UI (`features/marketing/`); trimmed
  `features/employees/` down to just the `EmployeeActionNoteEntry` type
  (matching the same trim already done in the main app's own Maya
  extraction).
- Config fully rebranded: `package.json` (`ask-todd`), `angular.json`
  (project `ask-todd`, output `dist/ask-todd`), `.firebaserc`/`firebase.json`
  (hosting target `ask-todd`), `index.html` (title/OG/canonical →
  `ask.taliferro.tech`), `environment.prod.ts` (`PLATFORM_URL` →
  `ask.taliferro.tech`).
- The routed page is currently just `ToddPlaceholderComponent`
  (`src/app/features/help/todd-placeholder/`) — it proves Firebase Auth
  wiring and the build/deploy pipeline work, nothing more. **The real
  chat experience has not been ported yet.**
- Verified clean: `npm install`, `npm run typecheck`, `npm run
  build:production`, and a local `ng serve` boot.

**Custom domain:** the Firebase Hosting site `ask-todd` exists and is
targeted correctly, but `ask.taliferro.tech` showed "Needs setup" in the
Firebase console and returns `404 Site Not Found` as of the last check —
DNS/domain-verification still needs to be finished (registrar-side,
only the user can do this).

## Phase 2 (done, uncommitted): the real ToddComponent is ported

`ToddPlaceholderComponent` is gone; `app.routes.ts`'s `''` route now loads
the real `ToddComponent` from
`src/app/features/help/todd/todd.component.ts` (copied from
`taliferrotech/frontend`'s ~2,500-line source, same relative import depth
so most of its own imports needed no path changes at all).

**Dependency graph gaps found and filled** (these did *not* already exist
in the maya-marketing fork and were copied over verbatim from
`taliferrotech/frontend`):
- `services/assistant-history.service.ts`, `services/daily-command.service.ts`,
  `services/admin-control.service.ts`, `services/helpers/phone-normalization.helper.ts`,
  `features/contact/utils/grading-engine.util.ts` (all of `daily-command.service.ts`'s
  own dependency chain, needed for the system-status rail).
- `shared/page/todd-system-outcomes/*`, `shared/utils/todd-status-indicator.util.ts`.
- `shared/page/command-palette/command-palette-entries.ts` (verbatim) +
  `command-palette-match.ts` (adapted — see below).
- `shared/styles/todd-status-indicators.css` (referenced by `todd.component.css`).
- `assets/ads/*` (an already-present service, `todd-guest-preview.service.ts`,
  imports `ads-manifest.json` — it was unreachable and silently uncompiled
  under the placeholder, only surfaced once `ToddComponent` pulled it in).
- Various `assets/*` image files the component and command palette
  reference directly (network/pulse/outreach/moves/docs icons, TODD
  solution/problem statement images, etc.).
- `GoalService` and everything else CLAUDE.md previously assumed was
  "already carried over" turned out to actually be byte-for-byte in sync
  with the main app already — no changes needed there.

**Not chased down (pre-existing, cosmetic, unrelated to this port):**
`assets/sounds/*.wav`/`.mp3` referenced by the already-present
`SoundService` 404 in the console. This gap predates Phase 2 — it was
just unreachable under the placeholder route, same as the `ads-manifest`
gap above, except this one doesn't block compilation so it was left
alone. Fix by copying `taliferrotech/frontend/src/assets/sounds/` over if
it starts to matter.

### Every internal route reference had to become external

The monolith's `ToddComponent` is full of same-origin navigation —
`router.navigate(['/network/app'])`, `appLinks`, the bottom nav, the
command-palette route-suggestions dropdown, suggested-product-action
routes, the "getting started" flow, `onClickRoute` (inherited from
`TopDogComponent`). None of those routes exist in this standalone app.
This is the same class of problem CLAUDE.md had already flagged for the
iframe embed mechanism below — it just turned out to be much bigger in
scope than only the embeds. The fix generalizes the same already-decided
rule (Network/Pulse external to their own domains, everything else
external to `todd.taliferro.tech`) to the whole component:

- `shared/utils/public-app-url.util.ts` gained `getMayaHomeUrl()`,
  `getLeadVaultHomeUrl()`, `getNetworkHomeUrl()`, `getPulseHomeUrl()`
  (copied from the main app, which already had them post-extraction) and
  a new `resolveExternalAppUrl(path)` — the one place that decides which
  origin a bare path like `/network/app` or `compose-email` resolves to.
- `todd.component.ts` gained a private `goExternal(path, queryParams?, newTab?)`
  that calls `resolveExternalAppUrl` and does `window.location.href` /
  `window.open` instead of `router.navigate` / `router.navigateByUrl`.
  Every call site that used to route internally (`askAssistant`'s
  auto-navigate, `onProductCardClick`, `onPublicProductClick`,
  `tryHandleToddHomeShortcut`'s direct-nav branch, `goToShowcasePrompt`,
  `goToSuggestedProduct`, `goToMomentumAction`) now goes through it.
  `onClickRoute` (from `TopDogComponent`) is overridden the same way.
- `command-palette-match.ts`'s `navigateToEntry` was adapted the same
  way; `command-palette-entries.ts` itself was copied verbatim (still the
  main app's route index) since the URL resolution happens in
  `navigateToEntry`, not in the entries.
- `appLinks` and the bottom nav (`todd.component.html`) were updated the
  same way — `external: true` + an absolute URL for everything except the
  chat's own `/`.
- **Known gap, accepted rather than solved:** the "draft an email" chat
  shortcut used to hand off `subject`/`body` via Angular router `state`,
  which can't cross an origin boundary. Since Compose Email isn't
  extracted anywhere, TODD now posts the drafted subject/body into the
  chat itself and sends the user to `todd.taliferro.tech/compose-email`
  with no prefill, instead of silently dropping the draft. Revisit if
  Compose Email ever gets its own extracted home with a URL-based
  handoff.

**Verified:** `npm run typecheck`, `npm run build:production`, and a
`ng serve` + headless-browser pass — the chat input renders on load
(no more placeholder), a quick-pill prompt gets a real assistant reply
with its image, and the only console errors are the pre-existing sound
404s above. The logged-in vs. logged-out answer-shaping code
(`buildProspectProfileContext`, `watchSystemOutcomes`, showcase prompts,
momentum briefing — all gated on `this.isLoggedIn`) was carried over
unchanged and wasn't independently re-verified against a real
authenticated session in this pass.

### The embedded-app / quick-nav iframe mechanism

`ToddComponent` iframes several internal routes directly into the chat
(search `embeddedAppPath` / `embeddedAppUrl` in the source) — this is the
"embedded view keeps records available without leaving TODD" feature.
The current (pre-extraction) targets:

- `/contact-list?embedded=true`
- `/documents?embedded=true`, `/knowledge-base?embedded=true`,
  `/survey-list?embedded=true`, `/moves-view?embedded=true`
- `/network/app?embedded=true`, `/pulse/app?embedded=true`,
  `/docs/app?embedded=true`, `/outreach/app?embedded=true`,
  `/moves/app?embedded=true`

**Important wrinkle discovered after Phase 1 shipped:** Network and Pulse
have since been separately extracted and are live at
`network.taliferro.tech` and `pulse.taliferro.tech` (real landing page at
`/`, real functional cockpit at `/app`, and — checked directly — both
already support `?embedded=true` in their own ported code). This is now
implemented in `tryOpenEmbeddedApp()`: Network and Pulse embed targets
point at `https://network.taliferro.tech/app?embedded=true` and
`https://pulse.taliferro.tech/app?embedded=true`; the other targets
(contact-list, documents, knowledge-base, survey-list, moves-view,
docs/app, outreach/app, moves/app) point at `todd.taliferro.tech`
internal routes — Docs/Outreach/Moves/Social are code-complete in their
own `web-products/*` repos but have no Hosting site wired yet, so they
aren't live anywhere external.

### Accepted auth tradeoff (v1, confirmed with user — do not relitigate without reason)

Firebase Auth sessions don't carry across subdomains — same limitation
Maya/Find/SayIt/Network/Pulse already live with. A user who's only ever
signed into `ask.taliferro.tech` and never separately into
`todd.taliferro.tech` (or `network.taliferro.tech`/`pulse.taliferro.tech`)
will see a login wall *inside* any embedded iframe pointed at one of
those origins, instead of their data. **Decided: accept this for v1.** No
SSO/custom-token bridge is being built in this pass. Document it, don't
silently "fix" it with a bigger architecture change unless asked.

### Main-app changes still pending (in `taliferrotech/frontend`, not here)

`/ask-todd` is referenced in ~25 places across the main app as the
default post-login/signup/onboarding destination (`public-home.guard.ts`,
`auth-flow.service.ts`'s `defaultToddStartUrl`, `finish-sign-in.component.ts`,
`todd-onboarding.service.ts`, `daily-momentum.component.ts`,
`command-palette-entries.ts`, `nav-config.service.ts`, marketing landing
page CTAs). Rewriting all of them individually was judged too risky.
**Recommended approach:** keep the `/ask-todd` route registered in the
main app, but swap its routed component from `ToddComponent` to the
existing `shared/page/external-redirect/external-redirect.component.ts`
(`ExternalRedirectComponent` — already used for `/help-wanted` →
`taliferro.com/careers`) pointed at `https://ask.taliferro.tech`. That
component needs a small enhancement first: forward `window.location.search`
so query params like `q`, `onboarding`, `guided`, `activationStage` (all
real, in use) survive the hop. This keeps every one of those ~25 call
sites working untouched.

Concrete steps (done in `taliferrotech/frontend`, on branch
`work-in-progress`, **uncommitted** as of this writing — verify before
assuming this landed):
1. ✅ `public-app-url.util.ts`: added `getAskToddHomeUrl()` → `https://ask.taliferro.tech`.
2. ✅ `external-redirect.component.ts`: forwards `window.location.search`;
   also swapped its hardcoded "Redirecting to Taliferro Careers…" text for
   a generic "Redirecting…" since it's now shared by two destinations.
3. ✅ `app.routes.ts`: the `ask-todd` route's `loadComponent` is now
   `ExternalRedirectComponent`, with `EXTERNAL_REDIRECT_URL` provided via
   `getAskToddHomeUrl()`.
4. ✅ `todd-assistant.component.ts`'s `openAskTodd()`: now
   `window.location.href = getAskToddHomeUrl()` instead of
   `router.navigate(['/ask-todd'])`.
5. ✅ `nav-config.service.ts`'s `global-ask-todd` flipped to
   `kind: 'callback'` + `openInNewTab(getAskToddHomeUrl())` (Maya's exact
   shape); `command-palette-entries.ts`'s `ask-todd` entry now has an
   absolute `path` + `external: true`.
6. ✅ `app.component.ts` / `.html`: removed `isAskToddRouteActive` and its
   one usage (was only hiding `<app-page-actions>` on `/ask-todd`).
7. ⏳ **Not done, deliberately** — delete `features/help/todd/` (+
   `todd-video-library.ts`) from the main app only after all of the above
   is verified working end to end in production.
8. Every other `/ask-todd` reference (public-home.guard, auth-flow
   service, finish-sign-in, onboarding, daily-momentum, marketing CTAs)
   was deliberately left alone — they resolve through the shim
   automatically. **Except one, below.**

### TODD is now the site's landing page, not just its post-login destination

Decided in this session: there's no longer a separate marketing landing
page for logged-out visitors. `public-home.guard.ts` (guards the root
route `/`) used to send only *logged-in* users to `/ask-todd` and let
logged-out visitors see `ToddLandingPageComponent`; it now sends
everyone there unconditionally (still carving out the dedicated
`sayit.taliferro.tech` host, same as before). This relies on
`ToddComponent`'s own guest-mode content (the `publicProducts` block,
`introAnswers`, the proactive guest intro) to carry the marketing job
TODD's chat is now expected to do that work for anonymous visitors too.
`ToddLandingPageComponent` itself was left in place, unreferenced from
`/`, for the same reason step 7 above is deferred — don't delete code
that's only provably dead once this is verified live. Its
`public-home.guard.spec.ts` was rewritten to match (no more
signed-in/signed-out branch — single synchronous redirect + the
dedicated-host carve-out).

**Explicitly out of scope for this pass** (confirmed with the user):
`/products`, `/proof`, `/pricing`, `/suite/pricing` are untouched — this
was scoped to the root route only.

## Don't re-derive these decisions from scratch

- **This app has exactly one real route: `/`.** Confirmed explicitly by
  the user. `app.routes.ts` should stay a single `''` route (`ToddComponent`)
  plus a wildcard back to it — never add second-class routes here for
  things like a dedicated "saved" view or a settings page; those are
  either embedded components inside the TODD chat itself (the
  `embeddedAppPath`/`embeddedAppUrl` iframe mechanism, or genuinely new
  UI state within `ToddComponent`) or they belong in a different app
  entirely. If a future request implies "add a route to ask-todd,"
  that's a signal to stop and check with the user first.
- Redirect-shim over rewriting call sites: deliberate, because of the
  ~25-site blast radius above.
- Accept-for-v1 on cross-origin auth: deliberate, confirmed with the user
  twice (once for this app, once for Network/Pulse).
- Network/Pulse embed targets point external, everything else internal:
  deliberate, based on what's actually deployed as of this writing — if
  Docs/Outreach/Moves/Social go live later, revisit their embed targets
  too. This same rule now also governs every other internal-route
  reference in `ToddComponent` (see Phase 2 above,
  `resolveExternalAppUrl`) — it's one rule applied consistently, not two
  separate decisions.
- Compose Email's draft handoff degrades to "post the draft in chat, open
  the composer with no prefill" rather than being silently dropped or
  blocked on building a cross-origin state-passing mechanism: deliberate,
  matches the spirit of the accepted auth tradeoff above (document a
  known cross-origin limitation instead of solving it now).
