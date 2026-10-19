# GoldDemo UI

Import this repository into a separate Vercel project named GoldDemo (`golddemo`),
using production branch `feature/white-label-demo`, the Vite preset, `npm ci`,
`npm run check`, and output `dist`. Existing vercel.json supplies these settings.

Copy `.env.example` for local setup or add its variables in the new Vercel project.
Set `NEXT_PUBLIC_APP_NAME=GoldDemo` and `VITE_API_BASE_URL` to the separately
provisioned demo API URL. Public branding is embedded at build time. The shipped
`/demo-logo.svg` is generic; use `NEXT_PUBLIC_APP_LOGO` for your own local asset.
Never place database URLs, passwords, or service-role keys in the UI project.

Requested address: `goldsmith.vercel.app`, subject to availability in Vercel.
Assign it to this new project through Domains, then set the API's CORS_ORIGIN to
its exact HTTPS origin. A vercel.app subdomain does not require external DNS.
The API rejects unlisted origins; add preview origins explicitly for testing.

The API repository's `DEMO_DEPLOYMENT.md` contains the full fresh Supabase setup,
seed commands, API configuration, quota blocker, and verification checklist:
[API deployment guide](https://github.com/maiku10010/nilosgold/blob/feature/white-label-demo/DEMO_DEPLOYMENT.md).

On 2026-10-20 Supabase refused a new demo project because the account's free
project quota is full. Database provisioning/seeding and live deployment remain
pending. No shop database or existing Vercel project was repointed.
