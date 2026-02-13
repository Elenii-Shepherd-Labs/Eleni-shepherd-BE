import { Controller, Post, Body, Param, Get, Delete } from '@nestjs/common';
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

@ApiTags('Conversational AI')
@Controller('conversational-ai')
export class ConversationalAiController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('sessions')
  @ApiOperation({
    summary: 'Create a new conversation session',
    description:
      'Initialize a new conversation session for a user. Returns the session ID.',
  })
  @ApiBody({
    type: CreateSessionDto,
    description: 'Session creation parameters',
  })
  @ApiResponse({
    status: 201,
    description: 'Session created successfully',
    type: SessionResponseDto,
  })
  async createSession(
    @Body() createSessionDto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return this.conversationService.initializeSession(
      sessionId,
      createSessionDto.userId,
    );
  }

  @Get('sessions/:sessionId')
  @ApiOperation({
    summary: 'Get session details',
    description: 'Retrieve conversation session details by session ID.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The session ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Session retrieved successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(@Param('sessionId') sessionId: string) {
    const session = await this.conversationService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({
    summary: 'Send a message in a session',
    description:
      'Process a user message and get an AI response. Supports free-form natural language.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The session ID',
    type: 'string',
  })
  @ApiBody({
    type: ProcessMessageDto,
    description: 'Message to process',
  })
  @ApiResponse({
    status: 200,
    description: 'Message processed successfully',
    schema: {
      properties: {
        response: { type: 'string', description: 'AI response' },
        sessionId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async processMessage(
    @Param('sessionId') sessionId: string,
    @Body() processMessageDto: ProcessMessageDto,
  ) {
    const response = await this.conversationService.processMessage(
      sessionId,
      processMessageDto.userMessage,
    );
    return {
      response,
      sessionId,
    };
  }

  @Post('sessions/:sessionId/context')
  @ApiOperation({
    summary: 'Add context to a session',
    description: 'Provide additional context for the conversation.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The session ID',
    type: 'string',
  })
  @ApiBody({
    type: AddContextDto,
    description: 'Context to add',
  })
  @ApiResponse({
    status: 200,
    description: 'Context added successfully',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async addContext(
    @Param('sessionId') sessionId: string,
    @Body() addContextDto: AddContextDto,
  ) {
    await this.conversationService.addContext(sessionId, addContextDto.context);
    return { message: 'Context added', sessionId };
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({
    summary: 'End a session',
    description: 'Terminate a conversation session.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The session ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Session ended successfully',
  })
  async endSession(@Param('sessionId') sessionId: string) {
    await this.conversationService.endSession(sessionId);
    return { message: 'Session ended', sessionId };
  }

  @Delete('sessions/:sessionId/history')
  @ApiOperation({
    summary: 'Clear conversation history',
    description: 'Remove all messages from a conversation session.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The session ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'History cleared successfully',
  })
  async clearHistory(@Param('sessionId') sessionId: string) {
    await this.conversationService.clearHistory(sessionId);
    return { message: 'History cleared', sessionId };
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'Get all active sessions',
    description: 'Retrieve all active conversation sessions (admin/monitoring).',
  })
  @ApiResponse({
    status: 200,
    description: 'Sessions retrieved successfully',
    type: [SessionResponseDto],
  })
  async getActiveSessions() {
    return this.conversationService.getActiveSessions();
  }

  @Get('sessions/user/:userId')
  @ApiOperation({
    summary: 'Get sessions by user ID',
    description: 'Retrieve all sessions for a specific user.',
  })
  @ApiParam({
    name: 'userId',
    description: 'The user ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'User sessions retrieved successfully',
    type: [SessionResponseDto],
  })
  async getUserSessions(@Param('userId') userId: string) {
    return this.conversationService.getUserSessions(userId);
  }
}
