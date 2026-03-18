# Backend Workflows

## Google OAuth

1. The Expo app opens backend `GET /auth/google` in the browser and passes its runtime deep link in query `state`.
2. Google returns to the backend callback.
3. The backend validates or creates the user.
4. The backend establishes a session.
5. The backend validates the request-scoped `state` URL and redirects only to that client-provided target.
6. For mobile deep links, the backend appends a short-lived `exchangeCode`.
7. The app exchanges that code through `POST /auth/mobile/exchange` and receives the app-owned auth token plus canonical profile payload.

### Direct Token Compatibility
1. A compatible client can still send a Google ID token to `POST /auth/google/token`.
2. The backend verifies the token with Google using `GOOGLE_CLIENT_ID`.
3. The backend upserts the canonical user record and issues the app's own auth token.

## Onboarding

1. Mobile deep-link auth return hydrates user state.
2. Client uploads voice name audio or sends full name JSON.
3. Backend persists the user name fields.
4. Client marks onboarding complete and enables the main app shell.

## Conversational AI

1. Client creates a conversation session.
2. Client sends messages against the session.
3. Backend loads recent session state from cache.
4. `LlmService` generates a response.
5. Backend stores the assistant message and returns response text.

## Vision And Accessibility

1. Client uploads an image.
2. Vision or accessibility service analyzes the image.
3. Backend returns structured detection or generated speech output.

## Telehealth

1. Client creates or reads reminders.
2. Symptom checks are routed through shared LLM orchestration.
3. Medical document analysis uses multimodal image analysis.
