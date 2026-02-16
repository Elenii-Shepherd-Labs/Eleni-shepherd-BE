# System Workflow

This document describes key request flows, data paths, and sequence diagrams for the Eleni Shepherd backend (modular NestJS monolith).

## High-level
- Single NestJS application bootstrapped at `apps/app/src/main.ts` with `AppModule` registering feature modules.
- Caching: Redis-backed `CacheModule` is enabled in `AppModule` (cache-manager + redis-store).
- Session cookies: `express-session` + Passport for authentication; server-side session storage is configurable.

---

## Authentication (Google OAuth)

Sequence (simplified):

Client -> GET /auth/google -> Server (Passport Google strategy) -> Redirect to Google
Google -> Callback -> Server GET /auth/google/callback -> `AuthService.validateUser(...)` -> `req.login(dbUser)` -> Redirect to client (302)

Notes:
- Successful auth sets a server session cookie for subsequent requests.
- Endpoint files: `apps/app/src/auth/*`.

---

## Onboarding (name capture)

Sequence (file upload):

Client (multipart audio) -> POST /onboard/name -> `OnboardingController` receives file -> `TranscriptionService.transcribeFromFile()` -> `OnboardingService.saveName(...)` -> Response 201

Endpoints: `apps/app/src/onboarding/onboarding.controller.ts`.

---

## Audio Processing / STT

1) Chunked audio flow
Client -> POST /audio-processing/chunk (JSON base64) -> `AudioProcessingService.processAudioChunk(...)` -> returns transcript fragments (200)

2) File upload flow
Client -> POST /audio-processing/chunk-file (multipart) -> `AudioProcessingService.processAudioChunk(...)` -> returns transcript (200)

3) Speech-to-text
Client -> POST /speech-to-text/transcribe (multipart) -> `SpeechToTextService.transcribeAudio(...)` -> returns `{ text, isFinal, provider }` (200)

Endpoints: `apps/app/src/audio-processing`, `apps/app/src/speech-to-text`.

---

## Text-to-Speech (TTS)

Client -> POST /text-to-speech/generate -> `TextToSpeechService.generateSpeech(...)` -> returns binary audio (Content-Type: audio/mpeg, 200)

Alternative: `/text-to-speech/generate/json` returns base64 JSON.

Endpoints: `apps/app/src/text-to-speech`.

---

## Conversational AI / LLM

1) Create session
Client -> POST /conversational-ai/sessions -> `ConversationService.initializeSession()` -> Session stored in Redis cache (201)

2) Send message
Client -> POST /conversational-ai/sessions/:sessionId/messages -> `ConversationService.processMessage()`
- Service fetches session from Redis
- Appends user message
- Calls `LlmService.generateResponse(messages, context)`
- Appends assistant message, trims history
- Persists session back to Redis
- Returns AI response (200)

3) Lifecycle
- GET session -> returns session or 404
- DELETE session -> removes session from cache
- POST context -> updates session.context

Notes:
- Sessions are now persisted in Redis via the global `CacheModule` (key: `conversation:session:<sessionId>`).
- Active session index stored at `conversation:active_sessions` to allow listing sessions.
- Files: `apps/app/src/conversational-ai`.

---

## Error Handling & HTTP codes
- Validation via global `ValidationPipe`.
- Controllers use Nest HTTP exceptions: `BadRequestException`, `NotFoundException`, etc.
- Create endpoints return `201` where applicable; redirects use `302`.

---

## Deployment & scaling notes
- Current architecture: modular monolith (single deployable). Scales vertically and horizontally with caveats:
  - Auth sessions use `express-session`. For horizontal scaling, use a shared session store (Redis) or stateless tokens.
  - Conversation sessions were migrated from in-memory Map to Redis cache, enabling multiple app instances to share session state.
- To convert to microservices, split feature modules into separate services and use message queue or HTTP RPC.

---

## Quick file references
- App bootstrap: `apps/app/src/main.ts`
- Root module: `apps/app/src/app.module.ts`
- Auth: `apps/app/src/auth`
- Conversational AI: `apps/app/src/conversational-ai`
- LLM: `apps/app/src/llm`
- TTS: `apps/app/src/text-to-speech`
- STT/Audio: `apps/app/src/speech-to-text`, `apps/app/src/audio-processing`


If you want, I can add PlantUML diagrams or integrate a simple visual diagram file (SVG/PNG) in the repo next.