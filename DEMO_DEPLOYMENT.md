# GoldDemo UI

Import this repository into a separate Vercel project named GoldDemo (`golddemo`),
using production branch `feature/white-label-demo`, the Vite preset, `npm ci`,
`npm run check`, and output `dist`. Existing vercel.json supplies these settings.

Copy `.env.example` for local setup or add its variables in the new Vercel project.
Set `NEXT_PUBLIC_APP_NAME=GoldDemo` and `VITE_API_BASE_URL` to the separately
provisioned demo API URL. Public branding is embedded at build time. The shipped
`/demo-logo.svg` is generic; use `NEXT_PUBLIC_APP_LOGO` for your own local asset.
Never place database URLs, passwords, or service-role keys in the UI project.

Deployed UI: https://golddemo-five.vercel.app.
API: https://golddemo-api.vercel.app.
`goldsmith.vercel.app` is owned by another team and is unavailable.
Set both VITE_API_BASE_URL and VITE_DEMO_API_ORIGIN to the new demo API URL.
The build and client reject mismatches, preventing fallback to the shop API.
Set the API's CORS_ORIGIN to the exact new frontend HTTPS origin. A vercel.app subdomain does not require external DNS.
The API rejects unlisted origins; add preview origins explicitly for testing.

The API repository's `DEMO_DEPLOYMENT.md` contains the full fresh Supabase setup,
seed commands, API configuration, resource details, and verification checklist:
[API deployment guide](https://github.com/maiku10010/nilosgold/blob/feature/white-label-demo/DEMO_DEPLOYMENT.md).

On 2026-10-20, GoldDemo was provisioned as a new Singapore Supabase project
(kzupjvycvcspinpctmty) and seeded exclusively with fictional demo records.
The older nilosgold-db was paused with the user's authorization to free a slot.
The active nilosgold-db-singapore database and existing shop Vercel projects
were left unchanged. All new deployment variables use only GoldDemo resources.
