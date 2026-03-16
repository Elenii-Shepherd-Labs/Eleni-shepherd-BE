# Backend Deployment

This page is the operational quick reference for shipping the NestJS backend.

## Runtime Requirements

- Node.js compatible with the repo toolchain
- MongoDB
- Redis
- provider credentials for the features you enable

Optional:

- Python runtime for `vision-service`
- `ffmpeg` for audio-processing flows that depend on it

## Required Configuration

Start from [`.env.example`](../.env.example). The minimum production set is:

- `NODE_ENV`
- `PORT`
- `BASE_URL`
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `SESSION_SECRET`
- `SESSION_MAX_AGE_MS`
- `SESSION_TTL_SECONDS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `SUCCESS_REDIRECT_URL`

Feature-specific credentials such as `OPENAI_API_KEY`, `GNEWS_API_KEY`, and mail or payment keys should only be supplied when those modules are enabled.

## Build And Start

```bash
npm install
npm run build
npm run start:prod
```

The compiled app entrypoint is `dist/apps/app/main`.

## Develop Branch Deploy Automation

The backend can deploy to Render automatically from GitHub Actions:

- workflow: `.github/workflows/render-deploy-develop.yml`
- branch: `develop`
- deploy mechanism: Render deploy hook stored as `RENDER_DEPLOY_HOOK_URL`
- guardrail: the workflow runs `npm ci` and `npm run build` before the deploy hook is triggered

The workflow only runs when backend-impacting files change, so docs-only commits do not request a new Render deploy.

## Pre-Deploy Checks

- Confirm `npm run build` passes.
- Confirm MongoDB and Redis are reachable from the target environment.
- Confirm Google OAuth redirect URLs match the deployed backend origin.
- Confirm the mobile app points at the deployed backend base URL.
- Confirm `/api` Swagger loads in non-production environments where it is expected.

## Runbook Notes

### Auth Issues

- Verify `SESSION_SECRET` is set and stable across instances.
- Verify Redis-backed sessions are enabled in production and not silently falling back to memory.
- Verify the Google callback URL matches the deployed origin exactly.
- Verify the success redirect matches the mobile deep-link return target.

### Startup Issues

- Check that required Nest dependencies were installed cleanly.
- Check MongoDB and Redis connectivity first before debugging feature modules.
- If the app builds locally but not in CI, compare Node.js versions and lockfile state.
- If the Render deploy workflow fails before the hook call, verify `RENDER_DEPLOY_HOOK_URL` exists in GitHub Actions secrets.

### Vision Service

If a deployment relies on `vision-service`, deploy and monitor it separately from the Nest app. Keep its URL aligned with `VISION_SERVICE_URL`.
