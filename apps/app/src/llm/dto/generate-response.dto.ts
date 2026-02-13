import { IsString, IsEnum, IsOptional, IsNumber, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Message {
  @ApiProperty({
    enum: ['user', 'assistant', 'system'],
    description: 'The role of the message sender',
  })
  @IsEnum(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @ApiProperty({
    type: 'string',
    description: 'The content of the message',
  })
  @IsString()
  content: string;
}

export class GenerateResponseDto {
  @ApiProperty({
    type: [Message],
    description: 'Array of messages in the conversation',
  })
  @IsArray()
  messages: Message[];

  @ApiProperty({
    type: 'string',
    description: 'Optional context for the LLM',
    required: false,
  })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiProperty({
    type: 'number',
    description: 'Maximum tokens for the response (default: 500)',
    required: false,
    example: 500,
  })
  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @ApiProperty({
    type: 'number',
    description: 'Temperature for response diversity (0-2, default: 0.7)',
    required: false,
    example: 0.7,
  })
  @IsOptional()
  @IsNumber()
  temperature?: number;
}
