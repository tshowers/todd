# Ask TODD

TODD's chat and home experience as a standalone Angular 19 app, served at
**https://ask.taliferro.tech**. It was extracted from the main Taliferro Tech
frontend (`todd.taliferro.tech/ask-todd`, which now redirects here).

Ask TODD has no backend of its own. It shares the Firebase project
(`taliferrotech`: Auth, Firestore, Storage) and the backend API
(`https://api.taliferro.tech/api`) with every other Taliferro Tech app.

## Prerequisites

| Tool | Version / notes |
| --- | --- |
| Node.js | 20.x or 22.x (Angular 19 requirement; developed on 22.13) |
| npm | Comes with Node |
| Angular CLI | Optional globally; `npx ng …` uses the project's copy |
| Chrome | Needed by `npm test` (Karma runs ChromeHeadless) |
| Firebase CLI | `npm i -g firebase-tools`; needed only to deploy, with access to the `taliferrotech` project |
| `taliferro-ui` repo | Required. See below |

### Sibling repo: `taliferro-ui`

`@taliferro/ui` (the shared design tokens, universal menu, and Help/About
templates) is installed from a local folder, `file:../../taliferro-ui`, not
from npm. `npm install` fails unless that repo is checked out two levels up:

```
corporate/
├── taliferro-ui/            ← git clone https://github.com/tshowers/taliferro-ui.git
└── web-products/
    └── ask-todd/            ← this repo
```

## Setup

```bash
# 1. Clone taliferro-ui as a sibling (see above), then:
npm install

# 2. Create both environment files from the example
cp src/environments/environment.example.ts src/environments/environment.ts
cp src/environments/environment.example.ts src/environments/environment.prod.ts

# 3. Fill in real values (see "Configuration"), then:
npm start
```

The app runs at http://localhost:4200/.

## Configuration

Everything in `src/environments/` except `environment.example.ts` is
gitignored because it holds live keys. You need both files:

- `environment.ts`: local dev (`npm start`).
- `environment.prod.ts`: production builds. `npm run build` uses the
  production configuration by default, and it swaps in this file.

| Key | What it is | Where to get it |
| --- | --- | --- |
| `firebaseConfig.*` | Firebase web app config for project `taliferrotech` | Firebase console → Project settings → Your apps |
| `apiKey` | Google Cloud API key used by shared services | Existing developer / Google Cloud console |
| `googleMapsApiKey` | Google Maps JavaScript API key | Google Cloud console |
| `RECAPTCHA_KEY` | reCAPTCHA site key | Google reCAPTCHA admin |
| `linkPreview` | LinkPreview.net API key (URL previews) | Existing developer |
| `taliferroTenantId` | UID of the Taliferro tenant account (shared data, admin check) | Existing developer |
| `accessCode` | Access code for gated sign-up flows | Existing developer |
| `backendURL` | Backend API base | `'/api'` locally; `'https://api.taliferro.tech/api'` in prod |
| `PLATFORM_URL` | This app's own origin | `http://localhost:4200` / `https://ask.taliferro.tech` |
| `production` | Build flag | `false` / `true` |

The remaining keys are feature flags. The defaults in the example file are
correct.

### The backend in local dev is production

Locally, `backendURL: '/api'` goes through
[`src/proxy.conf.json`](src/proxy.conf.json) to **`https://api.taliferro.tech`**.
There is no local backend or emulator setup, so anything you do while
signed in reads and writes real production data.

### Signing in locally

`/login` sends you to TODD's hosted login on `todd.taliferro.tech` with
`client=ask-todd-web-local`. After you sign in, it returns to
`http://localhost:4200/auth/callback` with a one-time token
([`hosted-sign-in.guard.ts`](src/app/features/auth-callback/hosted-sign-in.guard.ts),
`AuthService.startHostedSignIn`). Use port 4200: the local client is
registered for it.

Firebase Auth sessions don't carry across subdomains. Embedded views that
point at `todd.taliferro.tech`, `network.taliferro.tech`, or
`pulse.taliferro.tech` may show their own login wall. This is an accepted
v1 tradeoff, not a bug.

## Routes

| Path | What |
| --- | --- |
| `/` | The TODD chat (`features/help/todd/todd.component.ts`) |
| `/awards` | Same chat, with the awards sheet open |
| `/help`, `/about` | Static Help/About pages, prerendered for SEO |
| `/login`, `/finish-sign-in`, `/auth/callback` | Sign-in handoff |
| `**` | Not found |

Links to other TODD products (Network, Pulse, contacts, compose email, …)
are external URLs to those apps, not routes here. They resolve through
`resolveExternalAppUrl` in
[`public-app-url.util.ts`](src/app/shared/utils/public-app-url.util.ts).

## SEO and prerendering

- Only `/help` and `/about` are prerendered at build time
  ([`app.routes.server.ts`](src/app/app.routes.server.ts)). The chat at `/`
  renders in the browser because its shared base component plays sounds
  on startup, which fails when prerendering.
- The `postbuild` script copies `index.csr.html` to `index.html`, so
  Firebase Hosting's `**` rewrite always gets the app shell.
- Default meta tags, Open Graph, the home canonical, and GA4 live in
  [`src/index.html`](src/index.html). `robots.txt` and `sitemap.xml` live in
  [`public/`](public/). Add new public pages to the sitemap.
- The Help/About pages set their own title, description, canonical,
  `og:url`, and (About) JSON-LD.

## Shared code: don't edit these here

These files are copied in from `taliferro-ui` and get overwritten on the
next sync. Change them in `taliferro-ui`, then run its `sync.sh`:

- `src/app/shared/product-pages/product-pages.component.{ts,html}` →
  `taliferro-ui/product-pages-component/sync.sh` (the app-specific part is
  `product-pages.config.ts`, which is edited here)
- The universal/platform menu (`src/app/shared/platform-menu/`) →
  `taliferro-ui/menu-component/`

## Commands

```bash
npm start                  # dev server on :4200 (proxy to production API)
npm run typecheck          # tsc, no emit
npm test                   # Karma + ChromeHeadless, single run
npm run build              # production build: bumps the version, runs postbuild (use this)
npm run build:production   # compile check only: skips the version bump and postbuild
```

Deploy only output from `npm run build`. npm runs the `prebuild`/`postbuild`
hooks only for `build`, so `build:production` output is missing the
`index.html` app shell that Hosting needs.

Every `start`/`build` regenerates `src/app/version.ts` (gitignored) with
the package version, short git SHA, and build time. `prebuild` also bumps
`package.json`'s `version` (`YYYY.MM.DD-build.N`).

## Deployment

Firebase Hosting site `ask-todd` in project `taliferrotech`, custom domain
`ask.taliferro.tech`.

```bash
./deploy.sh
```

`deploy.sh` selects the `taliferrotech` project, builds, and runs the
tests. If the working tree is dirty, it **commits everything** as
`Deploy: v<version>`. Then it runs
`firebase deploy --only hosting:ask-todd`. It stops before deploying if
the build or the tests fail.
