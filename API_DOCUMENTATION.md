# Eleni Shepherd API Documentation Guide for Frontend Developers

## Table of Contents
1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Handling](#error-handling)
5. [Endpoints Overview](#endpoints-overview)
6. [Common Patterns](#common-patterns)
7. [Code Examples](#code-examples)

---

## Getting Started

### API Base URL
- **Development**: `http://localhost:3000`
- **Production**: `https://api.example.com` (to be configured)

### Interactive API Documentation
The interactive Swagger UI is available at:
```
http://localhost:3000/api/docs
```

From the Swagger UI, you can:
- View detailed endpoint documentation
- See request/response schemas
- Try endpoints with sample data
- Download the OpenAPI specification

### Required Tools
- Any HTTP client (Postman, Insomnia, VS Code REST Client, etc.)
- Modern web browser (for Swagger UI)
- curl or similar CLI tool for testing

---

## Authentication

### Overview
This API uses **Google OAuth 2.0** with session-based authentication. All endpoints (except OAuth login) require a valid session.

### Authentication Flow

1. **Redirect to Google Login**
   ```
   GET /auth/google
   ```
   Browser redirects to Google sign-in page.

2. **Handle Google Callback**
   ```
   GET /auth/google/callback
   ```
   Google redirects here after successful authentication.
   Backend creates a session cookie and redirects to home page.

3. **Access Protected Endpoints**
   All subsequent requests automatically include the session cookie.
   No additional headers needed.

### Session Management

**Session Cookie Details**:
- **Name**: `sessionId` (configured in middleware)
- **Max Age**: 1 hour (3600000 ms)
- **Secure**: `false` for development, `true` in production
- **Persistence**: Redis-backed for horizontal scaling

**Logout**:
```
GET /auth/logout
```
Clears the session and redirects browser.

### Code Example (JavaScript/Fetch)

```javascript
// 1. Login (happens in browser, user redirected to Google)
window.location.href = 'http://localhost:3000/auth/google';

// 2. After callback redirect, session is set. Subsequent requests auto-include cookie.
const response = await fetch('http://localhost:3000/auth/profile', {
  credentials: 'include', // Important: send cookies with request
});
const user = await response.json();
console.log(user);

// 3. Logout
window.location.href = 'http://localhost:3000/auth/logout';
```

---

## Response Format

### Success Response

All successful responses follow this format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* actual response payload */ },
  "status": 200
}
```

**Fields**:
- `success` (boolean): Always `true` for successful responses
- `message` (string): Human-readable message
- `data` (any): Response payload (structure varies by endpoint)
- `status` (number): HTTP status code

### Error Response

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "data": null,
  "status": 400
}
```

**Fields**:
- `success` (boolean): Always `false` for errors
- `message` (string): Description of what went wrong
- `data` (null): Always `null` for errors
- `status` (number): HTTP error code

### Handling Responses in Frontend

```typescript
// TypeScript with strict null checks
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  status?: number;
}

// Fetch wrapper
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(endpoint, {
    credentials: 'include', // Important for session auth
    ...options,
  });
  return response.json();
}

// Usage
async function getProfile() {
  const resp = await apiCall('/auth/profile');
  
  if (!resp.success) {
    console.error('Failed:', resp.message);
    return null;
  }
  
  return resp.data; // Type-safe if generic specified
}
```

---

## Error Handling

### Common HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Process response normally |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Check request format/parameters |
| 401 | Unauthorized | User not authenticated, redirect to login |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Contact support |

### Error Response Examples

**Missing Required Field**:
```json
{
  "success": false,
  "message": "Missing required parameter: userId",
  "data": null,
  "status": 400
}
```

**Resource Not Found**:
```json
{
  "success": false,
  "message": "Session not found: session-123",
  "data": null,
  "status": 404
}
```

**Server Error**:
```json
{
  "success": false,
  "message": "Internal server error",
  "data": null,
  "status": 500
}
```

### Best Practices

```typescript
async function handleApiError(response: ApiResponse) {
  switch (response.status) {
    case 400:
      console.error('Invalid input:', response.message);
      // Show validation error to user
      break;
    case 401:
      console.error('Not authenticated');
      // Redirect to login
      window.location.href = '/auth/google';
      break;
    case 404:
      console.error('Resource not found:', response.message);
      // Show 404 message
      break;
    case 500:
      console.error('Server error');
      // Show generic error, log to monitoring service
      break;
    default:
      console.error('Unexpected error:', response.message);
  }
}
```

---

## Endpoints Overview

### Audio Processing (`/audio-processing`)
Real-time audio transcription with wake-word detection.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/audio-processing/chunk` | POST | Process audio chunk (base64) |
| `/audio-processing/chunk-file` | POST | Upload WAV file for processing |
| `/audio-processing/always-listen` | POST | Toggle always-listening mode |
| `/audio-processing/tap-to-listen` | POST | Activate tap-to-listen |

### Speech-to-Text (`/speech-to-text`)
Audio transcription with voice activity detection.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/speech-to-text/transcribe` | POST | Transcribe audio file |
| `/speech-to-text/voice-activity-detection` | POST | Detect voice in audio |

### Text-to-Speech (`/text-to-speech`)
Synthesize text to natural speech.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/text-to-speech/generate` | POST | Generate speech (returns MP3) |
| `/text-to-speech/generate/json` | POST | Generate speech (returns base64 JSON) |
| `/text-to-speech/get-available-voices` | POST | List available voices |

### LLM (`/llm`)
AI response generation with context.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/llm/generate` | POST | Generate single response |
| `/llm/generate/stream` | POST | Generate streaming response (future) |

### Conversational AI (`/conversational-ai`)
Multi-turn conversation sessions.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/conversational-ai/sessions` | POST | Create conversation session |
| `/conversational-ai/sessions/:sessionId` | GET | Get session details |
| `/conversational-ai/sessions/:sessionId/messages` | POST | Send message |
| `/conversational-ai/sessions/:sessionId/context` | POST | Add context to session |
| `/conversational-ai/sessions/:sessionId` | DELETE | End session |
| `/conversational-ai/sessions/:sessionId/history` | DELETE | Clear chat history |
| `/conversational-ai/sessions` | GET | Get all active sessions |
| `/conversational-ai/sessions/user/:userId` | GET | Get user's sessions |

### Onboarding (`/onboard`)
User profile setup.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/onboard/name` | POST | Save name from audio |
| `/onboard/fullname` | POST | Save full name |

### Auth (`/auth`)
User authentication and profile.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google` | GET | Initiate Google login |
| `/auth/google/callback` | GET | Google OAuth callback |
| `/auth/profile` | GET | Get authenticated user |
| `/auth/logout` | GET | Logout user |

---

## Common Patterns

### Pattern 1: Audio Upload

**Use Case**: Send audio file for transcription or analysis.

```typescript
async function uploadAudio(file: File): Promise<ApiResponse> {
  const formData = new FormData();
  formData.append('audioFile', file);
  formData.append('language', 'en'); // Optional

  const response = await fetch(
    'http://localhost:3000/speech-to-text/transcribe',
    {
      method: 'POST',
      body: formData,
      credentials: 'include',
    }
  );

  return response.json();
}

// Usage
const audioFile = document.getElementById('audio-input').files[0];
const result = await uploadAudio(audioFile);

if (result.success) {
  console.log('Transcribed text:', result.data.text);
} else {
  console.error('Transcription failed:', result.message);
}
```

### Pattern 2: Session-Based Conversation

**Use Case**: Maintain conversation state across multiple messages.

```typescript
class ConversationManager {
  private sessionId: string | null = null;

  async startConversation(userId: string): Promise<boolean> {
    const resp = await fetch(
      'http://localhost:3000/conversational-ai/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        credentials: 'include',
      }
    );

    const result = await resp.json();
    if (result.success) {
      this.sessionId = result.data.sessionId;
      return true;
    }
    return false;
  }

  async sendMessage(userMessage: string): Promise<ApiResponse> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const resp = await fetch(
      `http://localhost:3000/conversational-ai/sessions/${this.sessionId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage }),
        credentials: 'include',
      }
    );

    return resp.json();
  }

  async endConversation(): Promise<void> {
    if (!this.sessionId) return;

    await fetch(
      `http://localhost:3000/conversational-ai/sessions/${this.sessionId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    this.sessionId = null;
  }
}

// Usage
const conversation = new ConversationManager();
await conversation.startConversation('user-123');
const response = await conversation.sendMessage('Hello, how are you?');
console.log('AI:', response.data);
await conversation.endConversation();
```

### Pattern 3: Text-to-Speech with Audio Playback

**Use Case**: Convert text to speech and play audio in browser.

```typescript
async function textToSpeech(text: string, voice: string = 'nova') {
  const resp = await fetch(
    'http://localhost:3000/text-to-speech/generate/json',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
      credentials: 'include',
    }
  );

  const result = await resp.json();

  if (result.success) {
    // Play audio
    const audioData = `data:audio/mpeg;base64,${result.data.audio}`;
    const audio = new Audio(audioData);
    audio.play();
    return audio;
  } else {
    console.error('TTS failed:', result.message);
    return null;
  }
}

// Usage
const audio = await textToSpeech('Welcome to Eleni Shepherd');
```

### Pattern 4: Error Handling with Retry

**Use Case**: Robust error handling with exponential backoff.

```typescript
async function apiCallWithRetry(
  endpoint: string,
  options?: RequestInit,
  maxRetries: number = 3
): Promise<ApiResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        credentials: 'include',
        ...options,
      });

      const data = await response.json();

      if (data.success) {
        return data;
      }

      // Specific error handling
      if (data.status === 401) {
        // Redirect to login
        window.location.href = '/auth/google';
        throw new Error('Unauthorized');
      }

      if (data.status === 404) {
        throw new Error(data.message);
      }

      // Retry on 5xx errors
      if (data.status >= 500) {
        lastError = new Error(data.message);
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      throw new Error(data.message);
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError;
}

// Usage
try {
  const result = await apiCallWithRetry('/conversational-ai/sessions', {
    method: 'POST',
    body: JSON.stringify({ userId: 'user-123' }),
  });
  console.log('Success:', result.data);
} catch (error) {
  console.error('Failed after retries:', error.message);
}
```

---

## Code Examples

### React Hook for Session Management

```typescript
import { useState, useCallback } from 'react';

interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  status?: number;
}

export function useConversation() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        'http://localhost:3000/conversational-ai/sessions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
          credentials: 'include',
        }
      );

      const data: ApiResponse = await response.json();

      if (data.success) {
        setSessionId(data.data.sessionId);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (message: string): Promise<ApiResponse | null> => {
      if (!sessionId) {
        setError('No active session');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `http://localhost:3000/conversational-ai/sessions/${sessionId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userMessage: message }),
            credentials: 'include',
          }
        );

        const data: ApiResponse = await response.json();

        if (!data.success) {
          setError(data.message);
        }

        return data;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  const endSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch(
        `http://localhost:3000/conversational-ai/sessions/${sessionId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      setSessionId(null);
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  }, [sessionId]);

  return {
    sessionId,
    loading,
    error,
    startSession,
    sendMessage,
    endSession,
  };
}

// Usage in Component
export function ChatComponent() {
  const { sessionId, loading, error, startSession, sendMessage, endSession } =
    useConversation();
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');

  const handleStartChat = async () => {
    await startSession('user-123');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const result = await sendMessage(input);
    if (result?.success) {
      setMessages([...messages, input, result.data.response]);
      setInput('');
    }
  };

  const handleEndChat = async () => {
    await endSession();
    setMessages([]);
  };

  return (
    <div>
      {!sessionId && <button onClick={handleStartChat}>Start Chat</button>}

      {sessionId && (
        <>
          <div className="messages">
            {messages.map((msg, idx) => (
              <p key={idx}>{msg}</p>
            ))}
          </div>
          <form onSubmit={handleSendMessage}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Type a message..."
            />
            <button type="submit" disabled={loading}>
              Send
            </button>
          </form>
          <button onClick={handleEndChat}>End Chat</button>
        </>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

---

## Additional Resources

- **Swagger UI**: http://localhost:3000/api/docs
- **OpenAPI Specification**: http://localhost:3000/api-json
- **GitHub Issues**: Report bugs and feature requests
- **Slack Channel**: #eleni-shepherd-dev for questions

---

## Support

For questions or issues:
1. Check the Swagger documentation first
2. Review code examples in this guide
3. Check GitHub issues for similar problems
4. Contact the API team on Slack

Happy coding! 🚀
