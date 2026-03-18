# Eleni Shepherd Backend

NestJS backend for Elenii Shepherd. This repo contains the API, shared backend libraries, and the Python vision service used for some computer-vision experimentation and deployment paths.

## What This Backend Does

- Google OAuth authentication and session bootstrap
- onboarding and user profile persistence, including backend-owned onboarding completion
- conversational AI session management
- speech-to-text and text-to-speech
- accessibility helpers for reading and navigation
- radio and news aggregation
- telehealth reminders and AI-assisted health workflows

## Tech Stack

- NestJS 10
- TypeScript
- MongoDB with Mongoose
- Redis via cache-manager
- Passport Google OAuth
- OpenAI / Anthropic / ElevenLabs integrations
- Optional Python Flask vision sidecar

## Quick Start

```bash
cp .env.example .env
npm install
npm run start:dev
```

Build:

```bash
npm run build
```

## Develop Deploys

The backend repo can trigger a Render deploy automatically on pushes to `develop`:

- workflow: `.github/workflows/render-deploy-develop.yml`
- secret required: `RENDER_DEPLOY_HOOK_URL`
- guardrail: the workflow runs `npm ci` and `npm run build` before it requests the Render deploy

The workflow only runs for backend-impacting changes, so docs-only edits do not trigger a new deploy.

Test:

```bash
npm test
```

## Environment

Copy `.env.example` to `.env` and fill in the providers you need for the flows you are testing.

Core local values:

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=mongodb://localhost:27017/eleni-shepherd
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
SESSION_SECRET=change-me
SESSION_MAX_AGE_MS=3600000
SESSION_TTL_SECONDS=3600
SESSION_REDIS_PREFIX=sess:
SESSION_ALLOW_MEMORY_FALLBACK=true
GOOGLE_CLIENT_ID=your-google-web-client-id
GOOGLE_ALLOWED_CLIENT_IDS=optional-comma-separated-mobile-or-ios-client-ids
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

OAuth redirect targets are client-owned. Mobile or web clients must pass their runtime-generated callback URL in the OAuth `state` query param, and the backend will only redirect to a validated `state` target.

## Repository Layout

```text
apps/app/         Main NestJS application
libs/common/      Shared backend infrastructure
vision-service/   Python vision sidecar
docs/             Maintained backend documentation
```

## Documentation

- [Docs Index](./docs/index.md)
- [Architecture](./docs/architecture.md)
- [Development Guide](./docs/development.md)
- [API Overview](./docs/api.md)
- [Workflow Guide](./docs/workflows.md)
- [Deployment Notes](./docs/deployment.md)
- [Contributing](./CONTRIBUTING.md)

Compatibility entry points in `docs/`:

- [API Documentation](./docs/api-documentation.md)
- [Workflow Guide Alias](./docs/workflow-guide.md)
- [Swagger Guide](./docs/swagger-guide.md)
