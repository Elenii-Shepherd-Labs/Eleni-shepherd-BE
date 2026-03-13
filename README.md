# Eleni Shepherd Backend

NestJS backend for Elenii Shepherd. This repo contains the API, shared backend libraries, and the Python vision service used for some computer-vision experimentation and deployment paths.

## What This Backend Does

- Google OAuth authentication and session bootstrap
- onboarding and user profile persistence
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
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
SUCCESS_REDIRECT_URL=exp://127.0.0.1:8081/--/auth/callback
```

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
