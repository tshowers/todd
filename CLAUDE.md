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

## Status: Phase 1 done, Phase 2 not started

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

## Phase 2 (next): port the real ToddComponent

Source: `taliferrotech/frontend/src/app/features/help/todd/todd.component.ts`
(~2,500 lines) + `todd-video-library.ts`, plus its dependency graph
(mostly already copied in via the maya-marketing fork — verify nothing's
missing by tracing imports from a fresh `todd.component.ts` copy, same
methodology `maya-marketing`'s own README documents).

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
already support `?embedded=true` in their own ported code). So when
porting this mechanism, point the Network and Pulse embed targets at
`https://network.taliferro.tech/app?embedded=true` and
`https://pulse.taliferro.tech/app?embedded=true` instead of the internal
`todd.taliferro.tech` routes — that's their canonical home now. The other
targets (contact-list, documents, knowledge-base, survey-list,
moves-view, docs/app, outreach/app, moves/app) should stay pointed at
`todd.taliferro.tech` internal routes for now — Docs/Outreach/Moves/Social
are code-complete in their own `web-products/*` repos but have no Hosting
site wired yet, so they aren't live anywhere external.

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

Concrete steps once this app's chat experience actually works end to end:
1. `public-app-url.util.ts`: add `getAskToddHomeUrl()` → `https://ask.taliferro.tech`.
2. `external-redirect.component.ts`: forward `window.location.search`.
3. `app.routes.ts`: swap the `ask-todd` route's `loadComponent` to
   `ExternalRedirectComponent`, providing `EXTERNAL_REDIRECT_URL` via
   `getAskToddHomeUrl()`.
4. `todd-assistant.component.ts`'s `openAskTodd()`: external nav instead
   of `router.navigate(['/ask-todd'])`.
5. `nav-config.service.ts` + `command-palette-entries.ts`: flip the
   `ask-todd` entries to `external: true`, same shape as the Maya entries.
6. `app.component.ts`: review/remove the `isToddPage()`-style path check
   that special-cases `/ask-todd` chrome.
7. Delete `features/help/todd/` (+ `todd-video-library.ts`) from the main
   app only after all of the above is verified working end to end.
8. Leave every other `/ask-todd` reference alone — they resolve through
   the shim automatically.

## Don't re-derive these decisions from scratch

- Redirect-shim over rewriting call sites: deliberate, because of the
  ~25-site blast radius above.
- Accept-for-v1 on cross-origin auth: deliberate, confirmed with the user
  twice (once for this app, once for Network/Pulse).
- Network/Pulse embed targets point external, everything else internal:
  deliberate, based on what's actually deployed as of this writing — if
  Docs/Outreach/Moves/Social go live later, revisit their embed targets
  too.
