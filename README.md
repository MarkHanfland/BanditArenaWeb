# BanditArenaWeb

Unified Bandit Arena management console — local treadmill control and cloud fleet management in one React app.

## Architecture

| Traffic | Target |
|---------|--------|
| `https://banditarena.com/*` | S3 + CloudFront (this repo) |
| `https://banditarena.com/api/*` | Amplify API Gateway + Lambda |
| `http://localhost:8080/*` | Bandit Arena C++ REST (local device) |

## Local development

```powershell
cd c:\GitHub\BanditArenaWeb
copy .env.example .env
npm ci
npm run dev
```

Start Bandit Arena locally so device pages can reach `http://localhost:8080`.

Cloud pages use `/api/*` (Vite proxy → API Gateway in dev).

## Environment variables

See [`.env.example`](.env.example).

## Deploy

Production hosting is S3 + CloudFront via [`Deploy-BanditArenaWebsiteStack.ps1`](../BanditArenaCloudInfrastructure/scripts/aws/Deploy-BanditArenaWebsiteStack.ps1) and GitHub Actions [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

Set repository variables after stack deploy:

- `AWS_DEPLOY_ROLE_ARN`
- `S3_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`

## Source layout

```
src/
  api/device/     # localhost:8080 treadmill REST
  api/cloud/      # /api/* cloud REST
  pages/device/   # Dashboard, Treadmill, Services, ...
  pages/cloud/    # Users, Fleet, Billing, ...
  auth/           # Cognito PKCE (device + cloud modes)
```

Legacy UI copies in `BanditArena/web` and `BanditArenaCloud/web` are deprecated.
