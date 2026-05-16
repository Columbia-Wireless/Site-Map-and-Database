# Deploy Tower Demo to Cloud Run

Deploys the current source in `C:\Users\tomso\OneDrive\Desktop\tower-management-demo` to Cloud Run.

## Steps

1. Make sure the build is clean first:
```powershell
Remove-Item -Recurse -Force "C:\Users\tomso\OneDrive\Desktop\tower-management-demo\.next" -ErrorAction SilentlyContinue
Push-Location "C:\Users\tomso\OneDrive\Desktop\tower-management-demo"
npm run build
Pop-Location
```

2. Set the deploy account and deploy:
```powershell
gcloud config set account thomas@veripura.com
gcloud run deploy tower-demo --source "C:\Users\tomso\OneDrive\Desktop\tower-management-demo" --region us-east1 --project scetv-towers-2025
```

## Notes
- **Account**: Always `thomas@veripura.com` — has all required permissions (run.admin, storage.admin, artifactregistry.admin)
- **Service account** (`tower-deploy@...`) exists but is missing Artifact Registry access — do NOT use it
- **Source path**: `C:\Users\tomso\OneDrive\Desktop\tower-management-demo`
- **Cloud Run service**: `tower-demo`
- **Project**: `scetv-towers-2025`
- **Region**: `us-east1`
- **Live URL**: https://tower-demo-461686768358.us-east1.run.app
- **Supabase project**: `vfntpdpneusqgcwxwkix`
- gcloud cannot run inside Claude's sandboxed sessions — user must paste commands into their own PowerShell terminal
