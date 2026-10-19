# Deployment and checks

The Vercel project `nilosgoldui` deploys production automatically from GitHub
`main`. It uses Node 24, the Vite preset, `npm ci`, and `npm run check`.
Set `VITE_API_BASE_URL` to the backend URL before building. Never store private
API credentials in `VITE_` variables or commit environment files.

`npm run check` runs inventory/contact tests and creates the production build.
After pushing, confirm the deployment for the pushed commit is Ready and open
`https://nilosgoldui.vercel.app`.

For safe browser checks, run `node tests/preview.mjs` and open
`http://127.0.0.1:5174`. This separate development harness supplies synthetic
read-only records, rejects writes, and is not part of the production build.

Inventory Item Summary counts filtered ledger entries. Product Summary counts
distinct products represented by those entries, while their stock balances use
the full ledger. Gold is pooled in grams, including troy-ounce conversion;
other products are grouped by category, description, and unit. Units are shown
separately. Gold reference values use the displayed 24K market quote.

Both contact forms accept digits only, up to 11 characters, with a live counter.
Saving requires an 11-digit PH mobile number starting with 09. Existing or pasted
international +63 mobile numbers are normalized to local 09 format.

Gold metadata shows the provider and quote timestamp. Backup quotes disclose
daily FX conversion, and stale quotes are labeled. When no valid quote is
available, automatic pricing is disabled and job costing accepts a manual rate.

## Users and account passwords

Deploy the backend user-management migration/API before this frontend. Admins
have a Users navigation item for account creation, role changes, password resets,
and deactivation/reactivation. Temporary passwords exist only in the open copy
dialog state; closing the dialog clears them. Every account has Change password
in the user menu. Temporary-password sessions display Set your password before
navigation or business-data requests are enabled.

Inventory unit prices may be blank when unknown. The API must have the
`jewelry_inventory_unknown_prices` migration and nullable-price handling deployed
before this UI. Unknown prices remain NULL and do not create purchase expenses.
