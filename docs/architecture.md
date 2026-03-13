# Backend Architecture

## Architectural Style

The backend is a modular monolith built with NestJS.

It combines:

- one main Nest application under `apps/app`,
- shared infrastructure in `libs/common`,
- an optional Python vision service under `vision-service`.

## Major Modules

- `auth`
- `conversational-ai`
- `speech-to-text`
- `text-to-speech`
- `audio-processing`
- `onboarding`
- `radio-stations`
- `blog`
- `accessibility`
- `vision`
- `subscription`
- `telehealth`

## Infrastructure

- MongoDB for durable data
- Redis for cache-backed runtime state
- Passport and Express session for auth
- OpenAI, Anthropic, ElevenLabs, Radio Browser, and news providers

## Current Boundaries

### `libs/common`

Shared backend infrastructure:

- configuration,
- database bootstrap,
- response helpers,
- filters,
- common DTO and utility code.

### Feature Modules

Each feature module should own:

- controllers,
- services,
- DTOs,
- entities or schemas,
- domain-level orchestration.

## Notable Architectural Notes

- Conversational AI sessions are cache-backed and intentionally short-lived.
- Some vision flows now run directly through OpenAI-backed Nest services.
- The Python vision sidecar still exists, so documentation should keep the distinction explicit.
- Express session storage should be treated as production-sensitive infrastructure.
