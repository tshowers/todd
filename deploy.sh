#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

trap 'echo "Deploy aborted - a previous step failed, nothing was deployed." >&2' ERR

echo "Running Ask Todd production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Building the production Ask Todd bundle..."
npm run build

echo "Running Ask Todd tests..."
npm run test

echo "Running end-to-end tests (Cypress)..."
npm run e2e

if [ -n "$(git status --porcelain)" ]; then
  echo "Build and tests passed - committing changes before deploy..."
  VERSION="$(node -p "require('./package.json').version")"
  git add -A
  git commit -m "Deploy: v${VERSION}"
else
  echo "No changes to commit - working tree already clean."
fi

echo "Deploying Ask Todd to Firebase Hosting site ask-todd..."
firebase deploy --project taliferrotech --only hosting:ask-todd

echo "Ask Todd hosting deploy complete."

# Deploy succeeded, so the abort message no longer applies; a failed push
# is reported but doesn't undo or misreport the live deploy.
trap - ERR
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Pushing ${BRANCH} to GitHub..."
if git push origin "${BRANCH}"; then
  echo "Push complete."
else
  echo "WARNING: deploy is live, but git push failed - run 'git push origin ${BRANCH}' manually." >&2
  exit 1
fi
