# BanditArenaWeb Scripts

| Script | Description |
|--------|-------------|
| `Start-Local.ps1` | Starts the Vite dev server on `http://localhost:5173` |
| `Deploy.ps1` | Builds and deploys to production S3 + CloudFront via `BanditArenaCloudInfrastructure` |

## Local development

```powershell
cd c:\GitHub\BanditArenaWeb
.\scripts\Start-Local.ps1
```

Or use the VS Code task **BanditArenaWeb Start Local** from the workspace root.

Start Bandit Arena locally so device pages can reach `http://localhost:8080`.

## Production deploy

```powershell
cd c:\GitHub\BanditArenaWeb
.\scripts\Deploy.ps1
```

Requires AWS CLI credentials with access to stack `bandit-arena-website-prod`.

Or use the VS Code task **BanditArenaWeb Deploy**.

CI deploys automatically on push to `main` via [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).
