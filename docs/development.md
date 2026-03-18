# Backend Development Guide

## Requirements

- Node.js and npm
- MongoDB
- Redis
- provider API keys for full AI behavior

Optional:

- Python environment for `vision-service`
- `ffmpeg` for audio speed adjustment flows

## Setup

```bash
cp .env.example .env
npm install
npm run start:dev
```

Build:

```bash
npm run build
```

Tests:

```bash
npm test
```

Swagger:

```text
http://localhost:3000/api
```

## Suggested Local Environment

```bash
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
SESSION_SECRET=...
SESSION_MAX_AGE_MS=3600000
SESSION_TTL_SECONDS=3600
DATABASE_URL=mongodb://localhost:27017/eleni-shepherd
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

The native mobile app now starts Google OAuth through backend `GET /auth/google`, passing its runtime-generated callback URL in the OAuth `state` param. After Google returns to `GOOGLE_CALLBACK_URL`, the backend validates the redirect target, creates a short-lived `exchangeCode`, and redirects back into the app so the client can complete bootstrap through `POST /auth/mobile/exchange`.

`POST /auth/google/token` is still available for compatible clients that send a Google ID token directly, but the browser-callback flow is the primary mobile path.

## Python Vision Service

```bash
cd vision-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

## Development Expectations

- Keep transport concerns in controllers and orchestration in services.
- Prefer reusing shared infrastructure from `libs/common`.
- Update docs when changing auth, onboarding, vision, or API contracts.
- Validate mobile compatibility when changing redirect, session, or response semantics.
- Add new environment variables to `.env.example`.
