import { Controller, Post, Body, Param, Get, Delete, HttpCode, NotFoundException, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { ConversationService } from './conversation.service';
import {
  CreateSessionDto,
  ProcessMessageDto,
  AddContextDto,
  SessionResponseDto,
} from './dto';
import { Response } from 'express';

@ApiTags('Conversational AI')
@Controller('conversational-ai')
export class ConversationalAiController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('sessions')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a new conversation session',
    description: `
Initialize a new conversation session for a user. Sessions are persisted in Redis for horizontal scaling.

**Required Parameters**:
- \`userId\` (string): The user ID from authentication

**Session Lifecycle**:
1. Create session → returns sessionId
2. Send messages to the session using sessionId
3. Delete session when done (or it auto-expires after inactivity)

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/conversational-ai/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'user-123' }),
  credentials: 'include',
});
const data = await response.json();
const sessionId = data.data.sessionId;
\`\`\`

**Use Cases**:
- Start a new chat conversation
- Create a conversation context for multi-turn dialogue
- Maintain conversation history across requests
    `,
  })
  @ApiBody({
    type: CreateSessionDto,
    description: 'Session creation parameters',
    examples: {
      basic: {
        value: { userId: 'user-123' },
        description: 'Create session for a user',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Session created successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Session created' },
        data: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', example: 'session-1708041600000-abc123' },
            userId: { type: 'string', example: 'user-123' },
            createdAt: { type: 'string', format: 'date-time' },
            messages: { type: 'array', example: [] },
          },
        },
        status: { type: 'number', example: 201 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or missing userId',
  })
  async createSession(
    @Body() createSessionDto: CreateSessionDto,
    @Res() res: Response,
  ) {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const resp = await this.conversationService.initializeSession(
      sessionId,
      createSessionDto.userId,
    );
    return res.status(resp.status || 201).json(resp);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({
    summary: 'Get session details',
    description: `
Retrieve full conversation session details including messages and context.

**Parameters**:
- \`sessionId\` (path): The session ID returned from /sessions POST

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch(\`http://localhost:3000/conversational-ai/sessions/\${sessionId}\`, {
  credentials: 'include',
});
const session = await response.json();
\`\`\`

**Returns**: Complete session object with all messages and context.
    `,
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The session ID (obtained from POST /sessions)',
    type: 'string',
    example: 'session-1708041600000-abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Session retrieved successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            userId: { type: 'string' },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user', 'assistant'] },
                  content: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(@Param('sessionId') sessionId: string, @Res() res: Response) {
    const resp = await this.conversationService.getSession(sessionId);
    if (!resp || resp.status === 404) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    return res.status(resp.status || 200).json(resp);
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({
    summary: 'Send a message in a session',
    description: `
Process a user message and get an AI response. Supports free-form natural language.

**Parameters**:
- \`sessionId\` (path): The conversation session ID
- \`userMessage\` (body): The user's message

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch(\`http://localhost:3000/conversational-ai/sessions/\${sessionId}/messages\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userMessage: 'What is the weather?' }),
  credentials: 'include',
});
const result = await response.json();
console.log('AI Response:', result.data.response);
\`\`\`

**Important**:
- Messages are persisted in the session context
- LLM has access to previous messages for context
- Response includes both user message and AI response

**Use Cases**:
- Chat conversations
- Question answering with context
- Multi-turn dialogue
    `,
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The session ID',
    type: 'string',
  })
  @ApiBody({
    type: ProcessMessageDto,
    description: 'Message to process',
    examples: {
      simple: {
        value: { userMessage: 'Hello, how are you?' },
        description: 'Simple greeting',
      },
      contextual: {
        value: { userMessage: 'Can you remember this for later?' },
        description: 'Context-dependent message',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Message processed successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            response: { type: 'string', description: 'AI response' },
            sessionId: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async processMessage(
    @Param('sessionId') sessionId: string,
    @Body() processMessageDto: ProcessMessageDto,
    @Res() res: Response,
  ) {
    const resp = await this.conversationService.processMessage(
      sessionId,
      processMessageDto.userMessage,
    );
    return res.status(resp.status || 200).json(resp);
  }

  @Post('sessions/:sessionId/context')
  @ApiOperation({
    summary: 'Add context to a session',
    description: `
Provide additional context that the LLM can use when generating responses.

**Parameters**:
- \`sessionId\` (path): The conversation session ID
- \`context\` (body): Context information (string or object)

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch(\`http://localhost:3000/conversational-ai/sessions/\${sessionId}/context\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    context: 'User is asking about weather in Paris. They prefer Celsius.'
  }),
  credentials: 'include',
});
\`\`\`

**Use Cases**:
- Provide user preferences
- Add domain-specific information
- Set conversation scope or constraints
- Improve LLM response relevance
    `,
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The session ID',
    type: 'string',
  })
  @ApiBody({
    type: AddContextDto,
    description: 'Context to add',
    examples: {
      userPref: {
        value: { context: 'User prefers concise responses' },
        description: 'User preference context',
      },
      domain: {
        value: { context: 'Conversation is about machine learning' },
        description: 'Domain context',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Context added successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Context added' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            sessionId: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async addContext(
    @Param('sessionId') sessionId: string,
    @Body() addContextDto: AddContextDto,
    @Res() res: Response,
  ) {
    const resp = await this.conversationService.addContext(sessionId, addContextDto.context);
    return res.status(resp.status || 200).json(resp);
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({
    summary: 'End a session',
    description: `
Terminate a conversation session and clean up associated data.

**Parameters**:
- \`sessionId\` (path): The session ID

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch(\`http://localhost:3000/conversational-ai/sessions/\${sessionId}\`, {
  method: 'DELETE',
  credentials: 'include',
});
\`\`\`

**Post-Deletion**:
- Session data is removed from Redis
- Session cannot be accessed after deletion
- Frontend should clear sessionId from state
    `,
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The session ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Session ended successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Session ended' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            sessionId: { type: 'string' },
          },
        },
      },
    },
  })
  async endSession(@Param('sessionId') sessionId: string, @Res() res: Response) {
    const resp = await this.conversationService.endSession(sessionId);
    return res.status(resp.status || 200).json(resp);
  }

  @Delete('sessions/:sessionId/history')
  @ApiOperation({
    summary: 'Clear conversation history',
    description: `
Remove all messages from a conversation session while keeping the session active.

**Parameters**:
- \`sessionId\` (path): The session ID

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch(\`http://localhost:3000/conversational-ai/sessions/\${sessionId}/history\`, {
  method: 'DELETE',
  credentials: 'include',
});
\`\`\`

**Difference from DELETE /sessions/:sessionId**:
- **Clear History**: Session remains active, only messages removed
- **End Session**: Entire session is destroyed

**Use Cases**:
- Reset conversation without starting a new session
- Clear previous context while maintaining user session
- Prepare for a new topic in the same session
    `,
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The session ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'History cleared successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'History cleared' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            sessionId: { type: 'string' },
          },
        },
      },
    },
  })
  async clearHistory(@Param('sessionId') sessionId: string, @Res() res: Response) {
    const resp = await this.conversationService.clearHistory(sessionId);
    return res.status(resp.status || 200).json(resp);
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'Get all active sessions',
    description: `
Retrieve all currently active conversation sessions (admin/monitoring endpoint).

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/conversational-ai/sessions', {
  credentials: 'include',
});
const sessions = await response.json();
\`\`\`

**Use Cases**:
- Admin monitoring
- System health checks
- Session statistics
- Load monitoring

**Note**: This endpoint may be restricted to admin users in future versions.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Sessions retrieved successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              userId: { type: 'string' },
              messageCount: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getActiveSessions(@Res() res: Response) {
    const resp = await this.conversationService.getActiveSessions();
    return res.status(resp.status || 200).json(resp);
  }

  @Get('sessions/user/:userId')
  @ApiOperation({
    summary: 'Get sessions by user ID',
    description: `
Retrieve all conversation sessions created by a specific user.

**Parameters**:
- \`userId\` (path): The user ID

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch(\`http://localhost:3000/conversational-ai/sessions/user/\${userId}\`, {
  credentials: 'include',
});
const userSessions = await response.json();
\`\`\`

**Use Cases**:
- Retrieve user's chat history
- List user's active conversations
- Resume previous conversations
    `,
  })
  @ApiParam({
    name: 'userId',
    description: 'The user ID',
    type: 'string',
    example: 'user-123',
  })
  @ApiResponse({
    status: 200,
    description: 'User sessions retrieved successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              userId: { type: 'string' },
              messageCount: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getUserSessions(@Param('userId') userId: string, @Res() res: Response) {
    const resp = await this.conversationService.getUserSessions(userId);
    return res.status(resp.status || 200).json(resp);
  }
}
