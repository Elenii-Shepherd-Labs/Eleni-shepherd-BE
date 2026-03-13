# Backend Workflows

## Google OAuth

1. Client hits `GET /auth/google` with a redirect target in query state.
2. Google returns to the backend callback.
3. Backend validates or creates the user.
4. Backend establishes a session.
5. Backend redirects back to mobile or web.

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
