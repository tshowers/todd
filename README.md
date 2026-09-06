# Ask TODD

Standalone Angular app for TODD's chat/home experience, being extracted from the Taliferro Tech frontend (`todd.taliferro.tech/ask-todd`). Backend services, the Firebase project, Firestore data, authentication, and API contracts remain shared with Taliferro Tech — this app has its own sign-in, the same as the Maya, Find, and SayIt extractions.

**Status: scaffold only.** This repo currently serves a placeholder page. The real `ToddComponent` chat experience (quick-nav, embedded-app iframes, momentum briefing, video library, etc.) has not been ported yet — see the migration plan for the full scope and phasing.

## Known limitation (by design, for now)

Firebase Auth sessions don't carry across subdomains. A user who has only ever signed into `ask.taliferro.tech` and never separately into `todd.taliferro.tech` will hit a login wall inside any embedded-app iframe (e.g. an embedded contact list) that points back at `todd.taliferro.tech`. This mirrors how Maya/Find/SayIt already work and is an accepted v1 tradeoff, not a bug.

## Development

`src/environments/` holds live API keys and is gitignored. Copy `src/environments/environment.example.ts` to `environment.ts` (and `environment.prod.ts` as needed) and fill in real values before running the app — they're the same Firebase project (`taliferrotech`) and backend (`https://api.taliferro.tech/api`) as every other Taliferro Tech app.

```bash
npm install
npm start
```

The default local route is `http://localhost:4200/`.

## Validation

```bash
npm run typecheck
npm run build
npm run build:production
```

## Deployment

Hosted on Firebase Hosting, site `ask-todd` under the `taliferrotech` project, served at `ask.taliferro.tech`.

```bash
npm run build:production
firebase deploy --only hosting:ask-todd
```

Every `start`/`build`/`build:production` run regenerates `src/app/version.ts` (gitignored) via `scripts/generate-version.js`, stamping the package version, short git SHA, and build timestamp.
