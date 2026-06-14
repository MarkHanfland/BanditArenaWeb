# BanditArenaWeb

Unified Bandit Arena management console — local treadmill control and cloud fleet management in one React app.

## Architecture

| Traffic | Target |
|---------|--------|
| `https://banditarena.com/*` | S3 + CloudFront (this repo) |
| `https://banditarena.com/api/*` | Amplify API Gateway + Lambda |
| `http://localhost:9724/*` | Bandit Arena C++ REST (local device) |
| `http://localhost:5173/*` | Vite dev server (local development) |

When using the cloud-hosted UI at `banditarena.com`, device API calls go from the browser to `http://localhost:9724` on the operator's machine. The Bandit Arena REST server must allow CORS from `https://banditarena.com` (configured in `http_server.cpp`). Rebuild and restart `bandit_arena.exe` after CORS changes.

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

- Production: [`public/amplifyconfiguration.json`](public/amplifyconfiguration.json)
- Local dev: `.env` or example amplify config; device pages still use `http://localhost:9724`
- Device lab bypass: `auth_enabled: false` in Bandit Arena config skips Cognito
- E2E: `?e2eAuthBypass=true` or `VITE_E2E_AUTH_BYPASS=true`

## Environment variables

See [`.env.example`](.env.example).

## Deploy

Production hosting is S3 + CloudFront at `banditarena.com`:

```powershell
.\scripts\Deploy.ps1
```

Or use the VS Code task **BanditArenaWeb Deploy**.

Infrastructure stack: [`Deploy-BanditArenaWebsiteStack.ps1`](../BanditArenaCloudInfrastructure/scripts/aws/Deploy-BanditArenaWebsiteStack.ps1).

CI deploys on push to `main` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Source layout

```
src/
  api/device/     # localhost:9724 treadmill REST
  api/cloud/      # /api/* cloud REST
  pages/device/   # Dashboard, Treadmill, Services, ...
  pages/cloud/    # Users, Fleet, Billing, ...
  auth/           # Amplify UI Authenticator + Cognito (SRP in-app, OAuth for tokens/logout)
scripts/
  Start-Local.ps1 # Vite dev server
  Deploy.ps1      # S3 + CloudFront production deploy
```

## Related projects

| Project | Role |
|---------|------|
| `BanditArena` | C++ runtime; release packages `BanditArenaWeb/dist` into `build/bin/Release/web` |
| `BanditArenaCloud` | Amplify backend (Lambda, API Gateway, Cognito, DynamoDB) — no frontend hosting |
| `BanditArenaCloudInfrastructure` | S3/CloudFront stack, Cognito test pools, deploy scripts |

Legacy UI copies in `BanditArena/web` and `BanditArenaCloud/web` are deprecated.
