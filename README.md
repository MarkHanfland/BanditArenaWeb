# BanditArenaWeb

Unified Bandit Arena **operator console** — local treadmill control and cloud fleet management in one React app.

Public product marketing for Bandit Alpha lives in [BanditArenaWebsite](../BanditArenaWebsite) at `https://banditarena.com`. This repo must not ship marketing pages into the device `web/` dist.

## Architecture

| Traffic | Target |
|---------|--------|
| `https://console.banditarena.com/*` | S3 + CloudFront (this repo) |
| `https://console.banditarena.com/api/*` | Amplify API Gateway + Lambda |
| `https://banditarena.com/*` | Public product site ([BanditArenaWebsite](../BanditArenaWebsite)) |
| `http://localhost:9724/*` | Bandit Arena C++ REST (local device) |
| `http://localhost:5173/*` | Vite dev server (local development) |

When using the cloud-hosted console at `console.banditarena.com`, device API calls go from the browser to `http://localhost:9724` on the operator's machine. The Bandit Arena REST server must allow CORS from `https://console.banditarena.com` (configured in `http_server.cpp`). Rebuild and restart `bandit_arena.exe` after CORS changes.

Player enrollment and session reservations remain **staff-only console tabs**. They are not public self-service flows.

## Local development

```powershell
cd c:\GitHub\BanditArenaWeb
.\scripts\Start-Local.ps1
```

Or use the VS Code task **BanditArenaWeb Start Local**.

Start Bandit Arena locally so device pages can reach `http://localhost:9724`.

Cloud pages use `/api/*` (Vite proxy → API Gateway in dev).

## Authentication

Sign-in uses **Amplify UI Authenticator** on a branded Bandit login page (no redirect to Cognito Hosted UI for username/password). Cognito User Pool SRP handles credentials, MFA, and password reset in-app. OAuth/PKCE settings on the app client remain configured for token scopes, refresh, and global logout via the Hosted UI domain.

- Production: [`public/amplifyconfiguration.json`](public/amplifyconfiguration.json) (console host callbacks)
- Local dev: `.env` or example amplify config; device pages still use `http://localhost:9724`
- Device lab bypass: `auth_enabled: false` in Bandit Arena config skips Cognito
- E2E: `?e2eAuthBypass=true` or `VITE_E2E_AUTH_BYPASS=true`
- Cloud host detection: `console.banditarena.com` (`src/config/runtime.js`)

## Environment variables

See [`.env.example`](.env.example).

## Deploy

Production hosting is S3 + CloudFront at `https://console.banditarena.com`:

```powershell
.\scripts\Deploy.ps1
```

Or use the VS Code task **BanditArenaWeb Deploy**.

Infrastructure stack: [`Deploy-BanditArenaWebsiteStack.ps1`](../BanditArenaCloudInfrastructure/scripts/aws/Deploy-BanditArenaWebsiteStack.ps1).

CI deploys on push to `main` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Sync uses stack output `WebsiteBucketName`; invalidation uses `ConsoleDistributionId`.

Cutover: provision `console.banditarena.com` and deploy this app there **before** setting `ApexServesProductSite=true` on the website stack. Then run `Initialize-TestCognitoPools.ps1` so `bandit-cloud-client` includes console callback and logout URLs.

## Source layout

```
src/
  api/device/     # localhost:9724 treadmill REST
  api/cloud/      # /api/* cloud REST
  pages/device/   # Dashboard, Treadmill, Services, ...
  pages/cloud/    # Enrollment, Fleet, Billing, Session History, Accounts (Customer/Operator/Venue), ...
  auth/           # Amplify UI Authenticator + Cognito (SRP in-app, OAuth for tokens/logout)
scripts/
  Start-Local.ps1 # Vite dev server
  Deploy.ps1      # S3 + CloudFront production deploy (console host)
```

## Related projects

| Project | Role |
|---------|------|
| `BanditArena` | C++ runtime; release packages `BanditArenaWeb/dist` into `build/bin/Release/web` |
| `BanditArenaWebsite` | Public product site at banditarena.com |
| `BanditCorporateWebsite` | Corporate site at banditdesigngroup.com |
| `BanditArenaCloud` | Amplify backend (Lambda, API Gateway, Cognito, DynamoDB) — no frontend hosting |
| `BanditArenaCloudInfrastructure` | S3/CloudFront stack, Cognito test pools, deploy scripts |

Legacy UI copies in `BanditArena/web` and `BanditArenaCloud/web` are deprecated.
