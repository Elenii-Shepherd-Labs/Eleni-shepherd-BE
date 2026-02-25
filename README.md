# Eleni-shepherd-BE

This repository contains a NestJS backend (API) and a Python vision microservice used for OCR and object detection. The README below shows the project folder structure and summarizes the main files and functions for quick developer orientation.

**Quick Links**
- Swagger UI: http://localhost:3000/api
- Vision microservice health: http://localhost:5000/health

**Quick Start**
- Start Nest (dev):

```powershell
cd <repo-root>
npm install
npm run start:dev
```

- Start vision microservice (Windows PowerShell):

```powershell
cd vision-service
python -m venv .venv
& .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

**Environment**
- Set `VISION_SERVICE_URL` in the Nest environment to point to the running vision microservice (e.g., http://localhost:5000).
- Set API keys for OpenAI / ElevenLabs if TTS features are used.

**Project Folder Structure (high level)**

```
API_DOCUMENTATION.md
README.md
SWAGGER_GUIDE.md
apps/
  app/
    src/
      main.ts
      app.module.ts
      app.controller.ts
      app.service.ts
      accessibility/
      audio-processing/
      auth/
      blog/
      common/
      conversational-ai/
      llm/
      onboarding/
      radio-stations/
      speech-to-text/
      subscription/
      text-to-speech/
      vision/
libs/
  common/
vision-service/
  app.py
  requirements.txt
```

**Key Modules & Functions**

- **Bootstrap & API**
  - `apps/app/src/main.ts`: Boots Nest application, enables CORS, and mounts Swagger at `/api`.
  - `package.json` (repo root): Start/build scripts (`start:dev`, `build`).

- **Vision (Nest side)**
  - `apps/app/src/vision/vision.controller.ts`:
    - Endpoints: `/vision/detect`, `/vision/ocr`, `/vision/navigate`, `/vision/analyze` (multipart and base64 variants supported).
    - Validates uploads (image/* and video/*), handles file and base64 input, returns JSON responses from the vision microservice.
  - `apps/app/src/vision/vision.service.ts`:
    - Uses `axios` to call the Python microservice.
    - Configured with extended timeouts and increased body size to accommodate model loads and large payloads.

- **Vision Microservice (Python)**
  - `vision-service/app.py` (Flask app):
    - Routes: `/health`, `/detect`, `/ocr`, `/navigate`, `/analyze`.
    - `run_yolo_detect(image_bytes)`: placeholder for YOLO inference (currently falls back to `mock_detect()` until real model is integrated).
    - `run_ocr(image)`: attempts `pytesseract` then `easyocr` if available; returns recognized text.
    - `mock_detect()`: returns synthetic detection data used when YOLO not configured.
    - `_read_image_from_request(req)`: helper to parse multipart/base64 payloads into image bytes.

- **Text-to-Speech**
  - `apps/app/src/text-to-speech/dto/index.ts`:
    - `GenerateSpeechDto`: accepts `text`, optional `voice` and optional `speed`.
  - `apps/app/src/text-to-speech/text-to-speech.controller.ts`:
    - Endpoint: generate speech; forwards `voice` and `speed`.
  - `apps/app/src/text-to-speech/text-to-speech.service.ts`:
    - Integrates OpenAI / ElevenLabs providers.
    - Accepts `speed` and `voice` aliases (e.g., `nigerian` mapped to environment-specific voice IDs).
    - Optionally uses `ffmpeg` to post-process MP3 using the `atempo` filter when `speed !== 1`.

- **Auth & Onboarding**
  - `apps/app/src/auth/`: Google OAuth strategy and `auth.service.ts` for authentication flows.
  - `apps/app/src/onboarding/`: onboarding endpoints and DTOs used during user setup.

- **Other notable modules**
  - `speech-to-text/`: endpoints to transcribe audio using configured providers.
  - `audio-processing/`: audio upload and processing utilities.
  - `conversational-ai/`, `llm/`: LLM-related controllers and services wrapping chat/completion logic.
  - `libs/common/`: shared utilities, DTOs, configuration, database, and filters used across the monorepo.

**Testing & Swagger**
- Open Swagger at `http://localhost:3000/api` to interactively test endpoints. Use the `Try it out` button for multipart uploads and the JSON request bodies for base64 variants.
- Start the Python vision microservice before testing vision endpoints to receive real OCR/YOLO results (otherwise mock responses may be returned).

**Deployment Notes**
- Recommended: keep both services in the same repository (monorepo) and deploy as two separate services (e.g., on Render). Set `VISION_SERVICE_URL` in the Nest service to the public URL of the deployed vision microservice.
- Ensure system-level dependencies are available in the runtime for features you rely on:
  - `tesseract` binary for `pytesseract`.
  - `ffmpeg` for audio speed post-processing.
  - GPU/large model caching plan if using `easyocr` or YOLO model downloads in production.

**Where to look next**
- `apps/app/src/vision/vision.controller.ts` and `apps/app/src/vision/vision.service.ts` for request/response wiring.
- `vision-service/app.py` to implement `run_yolo_detect()` with a production YOLO model.
- `apps/app/src/text-to-speech/` for voice aliasing and speed handling.

If you'd like, I can also:
- Add a table of every endpoint + example payloads into `API_DOCUMENTATION.md` or a separate `SWAGGER_TESTS.md`.
- Implement YOLO inference in `vision-service/app.py` (requires selecting a model and adding dependencies).
# Eleni Shepherd — Backend

This repository contains the backend for the Eleni Shepherd project — a NestJS-based monorepo with an application under `apps/app` and shared code in `libs/common`.

## ⚡ Quick Links for Developers

- **Interactive API Docs** 📚: `http://localhost:3000/api/docs` (Swagger UI)
- **API Guide** 📖: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) — Complete guide for frontend devs
- **Swagger Guide** 🎨: [SWAGGER_GUIDE.md](./SWAGGER_GUIDE.md) — How to use/update Swagger docs
- **System Workflow** 🔄: [WORKFLOW.md](./WORKFLOW.md) — End-to-end system flows

## What This Repo Contains

- **NestJS app:** The main application lives in `apps/app` and implements API controllers, services, and the authentication flow.
- **Auth (Google OAuth):** Google OAuth strategy and related controllers/services are in `apps/app/src/auth` (see `AUTH_SETUP.md` for setup details).
- **Shared libraries:** `libs/common` contains shared modules, services, database abstractions, DTOs, filters and utilities used across the app.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root (see **Environment** below or `AUTH_SETUP.md`):
```bash
cp .env.example .env  # if available
```

3. Run the dev server:
```bash
npm run start:dev
```

4. Access Swagger docs:
```
http://localhost:3000/api/docs
```

5. Build:
```bash
npm run build
```

6. Run tests:
```bash
npm test
```

## Environment Variables

Create a `.env` file with at least the following values (refer to `AUTH_SETUP.md` for full guidance):

```
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
SESSION_SECRET=your-session-secret-key-here
MONGODB_URI=mongodb://localhost:27017/eleni-shepherd
REDIS_URL=redis://localhost:6379
NODE_ENV=development
APP_PORT=3000
```

## Project Structure (High-Level)

- apps/
  - app/
    - src/
      - main.ts — application entrypoint
      - app.module.ts — root module
      - app.controller.ts, app.service.ts
      - auth/ — authentication-related code
        - auth.controller.ts
        - auth.module.ts
        - auth.service.ts
        - google.strategy.ts
        - user.schema.ts
- libs/
  - common/
    - src/
      - common.module.ts
      - common.service.ts
      - database/
        - abstract.repository.ts
        - database.module.ts
      - filters/
        - response.filter.ts
      - pipes/
        - validation.pipe.ts
      - utils/

Key files (quick links):

- [AUTH_SETUP.md](AUTH_SETUP.md) — detailed Google OAuth setup and developer notes
- [apps/app/src/main.ts](apps/app/src/main.ts) — bootstrap
- [apps/app/src/app.module.ts](apps/app/src/app.module.ts) — application wiring
- [apps/app/src/auth/auth.module.ts](apps/app/src/auth/auth.module.ts) — auth module
- [apps/app/src/auth/google.strategy.ts](apps/app/src/auth/google.strategy.ts) — Google OAuth strategy
- [apps/app/src/auth/auth.controller.ts](apps/app/src/auth/auth.controller.ts) — auth endpoints
- [libs/common/src/database/abstract.repository.ts](libs/common/src/database/abstract.repository.ts) — DB abstraction
- [libs/common/src/filters/response.filter.ts](libs/common/src/filters/response.filter.ts) — global response filter

**Authentication overview**
- The app uses Passport and `passport-google-oauth20` for Google OAuth.
- Endpoints:
  - `GET /auth/google` — start Google sign-in
  - `GET /auth/google/callback` — OAuth callback
  - `GET /auth/profile` — authenticated profile
  - `GET /auth/logout` — logout
- See `AUTH_SETUP.md` for environment variables, Google Cloud Console steps, and troubleshooting.

**Development notes**
- Sessions are in-memory by default; production should use a persistent store (Redis or Mongo) as noted in `AUTH_SETUP.md`.
- Database: the code expects a MongoDB instance (use `MONGODB_URI`).
- The `libs/common` module centralizes shared code — prefer adding reusable logic there.

**Testing**
- Run `npm test` to execute unit tests. Tests are colocated where relevant (e.g. `validation.pipe.spec.ts`).

**Next steps & suggestions**
- Add `.env.example` with required variables (copy from `AUTH_SETUP.md`).
- Add CI workflow to run tests and lint on PRs.
- Add a short CONTRIBUTING section if others will collaborate.

If you want, I can:
- expand the README with example API responses, or
- add a `.env.example` and minimal Postman/HTTP collection to exercise the auth endpoints.

---
Generated summary based on repository files and `AUTH_SETUP.md`.

**Example API responses**

- `GET /auth/profile` (authenticated)

```json
{
  "_id": "642f1b2e9b1d4c6f9a0e4a2b",
  "username": "Jane Doe",
  "email": "jane@example.com",
  "googleId": "109876543210987654321",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

- `GET /auth/logout`

```json
{
  "message": "Logged out successfully"
}
```

- `GET /auth/google` — redirects the client to Google's OAuth consent screen. No JSON body — the response is an HTTP redirect (302) to Google's OAuth URL.

**.env.example**
I added an example environment file to the project root to make setup easier. Copy it to `.env` and fill in your secrets.

See [.env.example](.env.example) for the template.
# Clean NestJS Application

A minimal, clean NestJS application with essential packages and setup.

## Features

- **NestJS 9** - Core framework
- **Swagger/OpenAPI** - API documentation at `/docs`
- **Redis Caching** - Via `@nestjs/cache-manager` with `cache-manager-redis-store`
- **MongoDB** - Via Mongoose
- **Configuration** - Env-based config with `@nestjs/config`
- **Response Interfaces** - Standard response structure (`IAppResponse`)
- **Validation** - Class validator and transformer
- **Filters** - Response filter for consistent API responses

## Project Structure

```
apps/
  app/
    src/
      app.controller.ts    - Main health endpoint
      app.module.ts        - Root module
      app.service.ts       - Core service
      main.ts              - Bootstrap entry
      
libs/
  common/
    src/
      configuration/       - Environment configuration
      database/           - MongoDB/Mongoose setup
      filters/            - Response filter
      interfaces/         - Response interfaces (IAppResponse)
      pipes/              - Validation pipes
      utils/              - Utility functions
      dto/                - Empty (ready for your DTOs)
```

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn
- MongoDB instance
- Redis instance (optional, can use in-memory cache)

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file:

```env
NODE_ENV=development
APP_NAME=MyApp
PORT=3000
DATABASE_URL=mongodb://localhost:27017/mydb
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
CORS_ORIGIN=*
```

### Running the App

**Development:**
```bash
npm run build
npm run start
```
Or to run directly with node:
```bash
node dist/apps/app/main
```

**Production:**
```bash
npm run build
npm run start:prod
```

### API Documentation

Once running, visit: `http://localhost:3000/docs`

### Health Check

```bash
curl http://localhost:3000
# { "status": "ok" }
```

## Available Scripts

- `npm run build` - Build the application
- `npm run start` - Start the app
- `npm run start:dev` - Start in watch mode
- `npm run start:prod` - Run compiled production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

## Removed Components

The following have been removed for a clean slate:
- All feature modules (auth, user, wallet, etc.)
- Database models (use your own)
- Feature-specific DTOs
- Mailer, Cloudinary, Paystack integrations
- Event emitter, scheduler, JWT, Passport

## Next Steps

1. **Add your DTOs** in `libs/common/src/dto/`
2. **Create feature modules** in `apps/app/src/`
3. **Define your models** with Mongoose schemas
4. **Configure Redis** in `.env` or use in-memory cache
5. **Add your business logic**

## License

UNLICENSED
