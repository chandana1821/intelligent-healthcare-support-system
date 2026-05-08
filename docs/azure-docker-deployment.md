# Azure Docker Deployment

This project is deployment-ready for this architecture:

- Frontend: Azure Static Web Apps
- Backend: FastAPI Docker container on Azure App Service for Linux
- Database: MongoDB Atlas
- Container registry: Azure Container Registry

## Required Azure Resources

Create these manually in the Azure portal or Azure CLI:

- Resource group, for example `ihss-rg`
- Azure Container Registry, Basic SKU is enough for demos
- Azure App Service plan, Linux. Use Basic B1 or higher if the Free tier cannot run the AI dependencies.
- Azure Web App for Containers for the backend
- Azure Static Web App for the frontend

Create this manually in MongoDB Atlas:

- Atlas cluster
- Database user
- Network access rule. For demos, `0.0.0.0/0` works, but a narrower allowlist is safer.
- Connection string using `mongodb+srv://...`

## Backend Environment Variables

Set these in Azure App Service > Configuration > Application settings:

```text
APP_NAME=CareSphere AI
ENVIRONMENT=production
API_V1_PREFIX=/api/v1
FRONTEND_ORIGIN=https://<frontend-app-name>.azurestaticapps.net
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-url>/caresphere_ai?retryWrites=true&w=majority
MONGODB_DB=caresphere_ai
JWT_SECRET=<long-random-secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=720
STAFF_EMAIL_DOMAIN=caresphere.health
LLM_PROVIDER=mock
RAZORPAY_KEY_ID=<razorpay-key-id>
RAZORPAY_KEY_SECRET=<razorpay-key-secret>
RAZORPAY_WEBHOOK_SECRET=
PORT=8000
WEBSITES_PORT=8000
WEB_CONCURRENCY=2
GUNICORN_TIMEOUT=180
```

Only set AI provider keys if you enable those providers:

```text
OPENAI_API_KEY=
GEMINI_API_KEY=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_VERSION=
AZURE_OPENAI_DEPLOYMENT_NAME=
```

## Frontend Environment Variables

Set this in Azure Static Web Apps build configuration or GitHub Actions:

```text
VITE_API_URL=https://<backend-app-name>.azurewebsites.net/api/v1
VITE_RAZORPAY_KEY_ID=<razorpay-key-id>
```

The frontend no longer falls back to localhost. Production builds must set `VITE_API_URL`.

## Build, Tag, Push, Deploy Backend Manually

Log in:

```bash
az login
az acr login --name <acr-name>
```

Build and push:

```bash
docker build -t <acr-login-server>/intelligent-healthcare-backend:latest ./backend
docker push <acr-login-server>/intelligent-healthcare-backend:latest
```

Point App Service to the image:

```bash
az webapp config container set \
  --resource-group <resource-group> \
  --name <backend-app-name> \
  --docker-custom-image-name <acr-login-server>/intelligent-healthcare-backend:latest \
  --docker-registry-server-url https://<acr-login-server> \
  --docker-registry-server-user <acr-username> \
  --docker-registry-server-password <acr-password>
```

Set runtime port:

```bash
az webapp config appsettings set \
  --resource-group <resource-group> \
  --name <backend-app-name> \
  --settings WEBSITES_PORT=8000 PORT=8000
```

Restart:

```bash
az webapp restart --resource-group <resource-group> --name <backend-app-name>
```

Verify:

```bash
curl https://<backend-app-name>.azurewebsites.net/health
```

Expected:

```json
{"status":"ok","service":"CareSphere AI"}
```

## GitHub Actions Backend CI/CD

The workflow `.github/workflows/backend-container-azure.yml` builds the backend Docker image, pushes it to ACR, and updates App Service.

Add these GitHub repository secrets:

```text
AZURE_CREDENTIALS
AZURE_RESOURCE_GROUP
AZURE_BACKEND_APP_NAME
ACR_NAME
ACR_LOGIN_SERVER
ACR_USERNAME
ACR_PASSWORD
```

`AZURE_CREDENTIALS` is the JSON output from a service principal with permission to push to ACR and update the Web App.
`ACR_USERNAME` and `ACR_PASSWORD` come from ACR > Access keys when Admin user is enabled. For production, prefer App Service managed identity with AcrPull instead of long-lived registry passwords.

## Azure Portal Backend Settings

In the backend App Service:

- Deployment Center: Container Registry or GitHub Actions
- Image source: Azure Container Registry
- Image: `intelligent-healthcare-backend`
- Tag: `latest` or the GitHub SHA tag
- Application settings: all backend variables listed above
- General settings: Always On if the plan supports it
- Health check path: `/health`

## Azure Static Web Apps Settings

Use:

- App location: `/frontend`
- API location: leave empty
- Output location: `dist`
- Build command: `npm run build`

Make sure the build has:

```text
VITE_API_URL=https://<backend-app-name>.azurewebsites.net/api/v1
```

## Production Verification Checklist

- `https://<backend-app-name>.azurewebsites.net/health` returns success.
- Backend logs show MongoDB connected without timeout.
- Frontend loads from Azure Static Web Apps.
- Browser network requests go to `https://<backend-app-name>.azurewebsites.net/api/v1`, not localhost.
- Patient registration and login work.
- Admin can create a doctor with a password.
- Doctor login works.
- Appointment booking works.
- Already-booked slots are visible but disabled for the same doctor and date.
