# API Overview

## Primary Categories

### Authentication

- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/profile`
- `GET /auth/logout`

### Conversational AI

- `POST /conversational-ai/sessions`
- `GET /conversational-ai/sessions/:sessionId`
- `POST /conversational-ai/sessions/:sessionId/messages`

### Speech And Audio

- `POST /speech-to-text/transcribe`
- `POST /speech-to-text/voice-activity-detection`
- `POST /text-to-speech/generate`
- `POST /text-to-speech/generate/json`
- `POST /audio-processing/chunk`
- `POST /audio-processing/chunk-file`
- `POST /audio-processing/always-listen`

### Onboarding

- `POST /onboard/name`
- `POST /onboard/fullname`
- `POST /onboard/complete`

### Accessibility And Vision

- `POST /vision/obstacle`
- `POST /accessibility/read-aloud`
- `POST /accessibility/read-image-aloud`
- `POST /accessibility/navigate-and-speak`

### Content

- `GET /radio-stations`
- `GET /blog`

### Telehealth

- reminder, symptom-check, and medical document endpoints under `/telehealth`

## Response Model

The backend aims to return a normalized application response shape for JSON endpoints:

```json
{
  "success": true,
  "message": "Operation completed",
  "data": {},
  "status": 200
}
```

Some endpoints intentionally return binary audio responses instead.

## Interactive Docs

Use Swagger for the most current endpoint schemas:

```text
http://localhost:3000/api
```
