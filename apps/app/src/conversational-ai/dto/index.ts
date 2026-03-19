import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({
    type: 'string',
    description: 'Optional user ID to associate with the session',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class ConversationClientStateDto {
  @ApiProperty({
    type: 'string',
    required: false,
    example: 'Home',
  })
  @IsOptional()
  @IsString()
  currentRoute?: string;

  @ApiProperty({
    type: 'string',
    required: false,
    example: 'assistant',
    enum: ['pre_auth', 'awaiting_name', 'creating_profile', 'assistant'],
  })
  @IsOptional()
  @IsString()
  onboardingPhase?:
    | 'pre_auth'
    | 'awaiting_name'
    | 'creating_profile'
    | 'assistant';

  @ApiProperty({
    type: 'boolean',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hasVerifiedIdentity?: boolean;

  @ApiProperty({
    type: 'boolean',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isAlwaysListen?: boolean;
}

export class ProcessMessageDto {
  @ApiProperty({
    type: 'string',
    description:
      'The user message in free-form natural language (e.g., "What is the weather?" or "Tell me about history")',
  })
  @IsString()
  userMessage: string;

  @ApiProperty({
    type: 'string',
    description: 'Optional context to help the LLM provide better responses',
    required: false,
  })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiProperty({
    type: 'string',
    description: 'Optional current mobile route to ground UI-aware agent actions',
    required: false,
  })
  @IsOptional()
  @IsString()
  currentRoute?: string;

  @ApiProperty({
    type: () => ConversationClientStateDto,
    description:
      'Optional client runtime state to ground route-aware, onboarding-aware agent decisions',
    required: false,
  })
  @IsOptional()
  @IsObject()
  clientState?: ConversationClientStateDto;
}

export class AddContextDto {
  @ApiProperty({
    type: 'string',
    description: 'Context information to add to the session',
  })
  @IsString()
  context: string;
}

export class SessionResponseDto {
  @ApiProperty({
    type: 'string',
    description: 'Unique session identifier',
  })
  sessionId: string;

  @ApiProperty({
    type: 'string',
    description: 'Associated user ID (optional)',
    required: false,
  })
  userId?: string;

  @ApiProperty({
    type: 'array',
    description: 'Array of messages in the session',
  })
  messages: any[];

  @ApiProperty({
    type: 'string',
    description: 'Conversation context',
  })
  context: string;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'When the session was created',
  })
  createdAt: Date;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Last activity timestamp',
  })
  lastActivityAt: Date;

  @ApiProperty({
    type: 'boolean',
    description: 'Whether the session is interrupted',
  })
  interrupted: boolean;
}
