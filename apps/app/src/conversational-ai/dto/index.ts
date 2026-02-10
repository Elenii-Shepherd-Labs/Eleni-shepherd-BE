import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

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
    description:
      'Optional context to help the LLM provide better responses',
    required: false,
  })
  @IsOptional()
  @IsString()
  context?: string;
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
