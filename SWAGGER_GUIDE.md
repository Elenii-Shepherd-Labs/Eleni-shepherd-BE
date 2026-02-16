# Swagger Documentation Guide

## Overview

The Eleni Shepherd API uses **Swagger/OpenAPI 3.0** to provide interactive, self-documenting API documentation. Frontend developers can access and test endpoints directly from the browser.

## Accessing Swagger Documentation

### Development Environment
```
http://localhost:3000/api/docs
```

### Production Environment
```
https://api.example.com/api/docs
```

### Features Available in Swagger UI
- ✅ Interactive endpoint testing
- ✅ Full request/response schemas
- ✅ Live code examples
- ✅ Parameter validation
- ✅ Authentication support
- ✅ Error response documentation
- ✅ Example values for each endpoint
- ✅ Try-it-out functionality

## Document Structure

### 1. Global Configuration

Located in `apps/app/src/main.ts`, the Swagger configuration includes:

```typescript
new DocumentBuilder()
  .setTitle('Eleni Shepherd API')
  .setDescription('API description and feature list')
  .setVersion('1.0.0')
  .setContact(...)           // Team contact info
  .setLicense(...)           // License info
  .addTag(...)               // Endpoint grouping
  .addServer(...)            // Environment URLs
  .addCookieAuth(...)        // Authentication scheme
  .build()
```

### 2. Endpoint Documentation

Each endpoint is documented with:

```typescript
@ApiOperation({
  summary: 'Brief description',
  description: 'Detailed description with examples and use cases'
})
@ApiBody({ ... })           // Request body schema
@ApiResponse({ ... })       // Success response schema
@ApiResponse({ ... })       // Error response schemas
@ApiParam({ ... })          // URL parameters
@ApiQuery({ ... })          // Query parameters
```

### 3. Response Schema

All responses follow a standardized format documented in:
```
libs/common/src/dto/app-response.dto.ts
```

## How to Document a New Endpoint

### Step 1: Add Swagger Decorators

```typescript
@Controller('my-resource')
@ApiTags('My Feature')
export class MyController {
  
  @Post('create')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a new resource',
    description: `
Detailed description explaining:
- What the endpoint does
- When to use it
- Special requirements
- Frontend usage examples
    `
  })
  @ApiBody({
    type: CreateDto,
    examples: {
      basic: {
        value: { name: 'Example' },
        description: 'Basic example'
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Resource created',
    schema: { ... }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input'
  })
  async create(@Body() dto: CreateDto) {
    // Implementation
  }
}
```

### Step 2: Document DTOs

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateDto {
  @ApiProperty({
    description: 'Resource name',
    example: 'My Resource',
    minLength: 1,
    maxLength: 100
  })
  name: string;

  @ApiProperty({
    description: 'Optional description',
    required: false,
    nullable: true
  })
  description?: string;
}
```

### Step 3: Add Examples

Include practical examples in the description:

```typescript
description: `
**Frontend Usage**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/endpoint', {
  method: 'POST',
  body: JSON.stringify({ ... }),
  credentials: 'include'
});
\`\`\`

**Use Cases**:
- Use case 1
- Use case 2
`
```

## Current Documentation Status

### ✅ Fully Documented Endpoints

#### Authentication (`/auth`)
- Google OAuth flow
- Profile retrieval
- Logout

#### Conversational AI (`/conversational-ai`)
- Session management
- Message processing
- Context handling
- Multi-turn conversations

#### Speech-to-Text (`/speech-to-text`)
- Audio transcription
- Voice activity detection
- Language support

#### Text-to-Speech (`/text-to-speech`)
- Audio generation (binary)
- Audio generation (base64 JSON)
- Available voices listing

#### LLM (`/llm`)
- Response generation
- Message formatting
- Provider information

#### Audio Processing (`/audio-processing`)
- Chunk processing (base64)
- File upload processing
- Always-listening mode
- Tap-to-listen mode

#### Onboarding (`/onboard`)
- Name from audio
- Full name saving

### Documentation Enhancements Included

1. **Detailed Descriptions**
   - What each endpoint does
   - When to use it
   - Important constraints

2. **Frontend Code Examples**
   - Complete fetch examples
   - React patterns
   - Error handling

3. **Use Case Documentation**
   - Real-world scenarios
   - Best practices
   - Common patterns

4. **Parameter Documentation**
   - Required vs optional
   - Type information
   - Valid ranges/values

5. **Response Documentation**
   - Success format
   - Error scenarios
   - Data structure

6. **Example Values**
   - Request examples
   - Response examples
   - Edge cases

## Best Practices for Frontend Developers

### 1. Always Check Success Flag

```typescript
const response = await fetch('/api/endpoint', {
  credentials: 'include'
});
const data = await response.json();

if (data.success) {
  // Process data.data
} else {
  // Handle error - data.message
}
```

### 2. Include Credentials

```typescript
// ✅ Correct - includes session cookie
fetch('/api/endpoint', { credentials: 'include' })

// ❌ Wrong - won't send session cookie
fetch('/api/endpoint')
```

### 3. Handle Content Types

```typescript
// For JSON
fetch('/api/endpoint', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... })
})

// For FormData (don't set Content-Type!)
const formData = new FormData();
formData.append('file', file);
fetch('/api/endpoint', { body: formData })
```

### 4. Use Try-It-Out in Swagger

The Swagger UI includes a "Try it out" button for each endpoint:
1. Click "Try it out"
2. Fill in parameters
3. Click "Execute"
4. View response directly

This helps test before implementing.

### 5. Leverage Examples

Swagger includes multiple examples for each endpoint:
1. Basic usage
2. Advanced usage
3. Edge cases

Copy these to your frontend code as a starting point.

## Common Patterns

### Session-Based Flows

See Conversational AI documentation for complete session management examples.

### Audio Processing

See Audio Processing documentation for streaming vs. file upload patterns.

### Error Handling

All endpoints follow standard error format:
```json
{
  "success": false,
  "message": "Error description",
  "data": null,
  "status": 400
}
```

## Testing with Swagger

### Step 1: Access Swagger UI
```
http://localhost:3000/api/docs
```

### Step 2: Authenticate (if needed)
- Click "Authorize" button
- Google login via /auth/google
- Session automatically included

### Step 3: Test Endpoint
- Expand endpoint
- Click "Try it out"
- Fill parameters
- Click "Execute"
- Review response

### Step 4: Export Examples
- View "Request URL"
- Use curl command
- Copy to tests/documentation

## Integration with IDEs

### VS Code REST Client

```rest
### Get available voices
POST http://localhost:3000/text-to-speech/get-available-voices
Content-Type: application/json
Cookie: sessionId=<your-session-id>
```

### Postman

1. Import OpenAPI spec from `/api-json`
2. Variables auto-populated
3. Collections organized by tag
4. Pre-scripts for authentication

### Insomnia

1. Design → Open → OpenAPI URL
2. Import from `http://localhost:3000/api-json`
3. Requests auto-generated
4. Authentication pre-configured

## Continuous Documentation

### When to Update Swagger Docs

- ✅ Adding new endpoints
- ✅ Changing request/response format
- ✅ Adding new parameters
- ✅ Changing error handling
- ✅ Adding new status codes

### Documentation Checklist

- [ ] @ApiOperation with summary and description
- [ ] @ApiBody with examples
- [ ] @ApiResponse for success case
- [ ] @ApiResponse for each error case
- [ ] Frontend usage examples
- [ ] Use case documentation
- [ ] Parameter constraints documented
- [ ] Example values included

## Support & Questions

For questions about API documentation:

1. Check Swagger UI first (`/api/docs`)
2. Review `API_DOCUMENTATION.md`
3. Check endpoint description for examples
4. Ask in #api-support Slack channel

## Resources

- **Swagger UI**: `http://localhost:3000/api/docs`
- **OpenAPI Spec**: `http://localhost:3000/api-json`
- **API Documentation**: `API_DOCUMENTATION.md`
- **Code Examples**: See in each endpoint's description

---

Happy API development! 🚀
