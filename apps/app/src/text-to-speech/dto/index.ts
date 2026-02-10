import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateSpeechDto {
  @ApiProperty({
    type: 'string',
    description: 'Text to convert to speech',
    example: 'Hello, this is a test message.',
  })
  @IsString()
  text: string;

  @ApiProperty({
    type: 'string',
    description: 'Voice to use (alloy, echo, fable, onyx, nova, shimmer for OpenAI)',
    required: false,
    example: 'alloy',
  })
  @IsOptional()
  @IsString()
  voice?: string;
}

export class SpeechResponseDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Audio file in MP3 format',
  })
  audio: Buffer;

  @ApiProperty({
    type: 'string',
    description: 'The TTS provider used (openai, elevenlabs, or mock)',
    example: 'openai',
  })
  provider: string;

  @ApiProperty({
    type: 'number',
    description: 'Audio duration in seconds (approximate)',
  })
  duration?: number;
}
