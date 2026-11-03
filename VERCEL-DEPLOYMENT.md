# Vercel deployment

This repository supports two hosting targets:

- `npm run build`: the existing Cloudflare Worker, API, D1 login/session database and Supabase integration.
- `npm run build:vercel`: a static React frontend for Vercel, plus one same-origin API gateway to the existing Worker.

`vercel.json` selects the Other framework preset, the Vercel build command and `dist/vercel` output. Do not deploy this repository as a Next.js server build: its backend imports Cloudflare bindings. The Vercel build does not load the Sites plugin or require ignored `.openai/hosting.json` metadata.

## Existing project settings

Use the repository root directory. Keep build/output overrides disabled so `vercel.json` applies. The GitHub production branch is `main`. No Supabase keys, Google client secrets or Cloudflare API tokens need to be added to the Vercel frontend. They remain on the backend. Passwords/sessions and all workspace data stay in their existing databases.

After the new commit reaches GitHub, open the Vercel project and inspect its latest deployment. If necessary, Redeploy the latest commit, rather than the older failed commit. The project can also use `npm run build:vercel` and `dist/vercel` explicitly if a dashboard override was saved.

## API and authentication

`api/gateway.ts` uses the Vercel Node.js fetch handler. It proxies only known API paths to the fixed Hewers backend. It forwards host-only session cookies and workspace selection, validates browser Origin before translating an upstream POST, rejects cross-site writes and strips untrusted identity/forwarding headers. Responses are private and not cached. Writes are never automatically retried. There is no new database or account migration.

A Vercel visit needs its own sign-in using the same username/password; browser cookies are scoped to each hostname. Account changes, approvals and records remain shared because both addresses use the same backend. The original Cloudflare site must remain deployed.

## Google connection and site photos

Sync now runs through the gateway using the existing workspace Google connection. Connect/Reconnect opens the original Hewers site in a separate window, where the already-approved OAuth callback and its cookies remain valid. Sign in there if prompted, connect Google in Settings, then return to the Vercel site and refresh. No new Google OAuth callback registration is required.

Vercel Functions limit request bodies. The Vercel frontend accepts site photos up to 4 MB; the Cloudflare frontend retains its 8 MB limit. Images, face models and frontend assets are served as static Vercel assets. Face capture requires HTTPS and camera permission; device accuracy/performance still needs a real-camera acceptance test.

## Verification

Run `npx tsc --noEmit`, both build commands and the bundled `tests/vercel-proxy.test.ts`. The gateway tests cover signed-cookie forwarding, CSRF rejection, identity-header stripping, fixed upstream routing, request bodies, size limits, redirects and safe failures. A successful local build does not establish that a remote Vercel deployment or live sign-in has passed.
