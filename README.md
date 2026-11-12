# Nilo’s Gold

Nilo’s Gold is a business management system that staff use to record sales, expenses, inventory movements, and job costs. It replaces an Excel-based workflow that made records difficult to organize and increased the risk of inconsistent inputs and calculation errors.

The main workflow begins with a customer inquiry, continues through job costing, and tracks work completion separately from payment.

## Main workflow

1. Record a customer inquiry.
2. Create a job costing record linked to the inquiry.
3. Track the job until the work is finished.
4. Track customer payments separately from work completion.

A finished job may still have an outstanding balance.

## Run the frontend locally

### Prerequisites

- Node.js and npm
- The backend running at http://localhost:3000

From the frontend project folder:

### 1. Install dependencies

```powershell
npm ci
```

### 2. Create your local configuration

```powershell
Copy-Item .env.example .env.local
```

### 3. Start the development server

```powershell
npm run dev
```

### 4. Open the application

Open the local URL printed in the terminal.

The backend must allow the frontend’s local origin in its CORS configuration.

Database credentials belong in the backend configuration, never in the frontend.

## Hosted API and sign-in

Production builds use `/api` on the frontend domain. The API rewrite in
`vercel.json` forwards these requests to the backend before the SPA fallback.
This keeps the HttpOnly session cookie first-party, including on iPhone and
iPad Safari where cross-site cookies are blocked. `VITE_API_BASE_URL` is only
used during local development; production builds always use the same-origin proxy.
