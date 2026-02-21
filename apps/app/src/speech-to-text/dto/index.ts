import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TranscribeAudioDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Audio file to transcribe (WAV, MP3, etc.)',
  })
  audioFile: any;

  @ApiProperty({
    type: 'string',
    description: 'Language code (e.g., "en", "es", "fr")',
    required: false,
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string;
}

export class TranscriptionResponseDto {
  @ApiProperty({
    type: 'string',
    description: 'Transcribed text from audio',
  })
  text: string;

  @ApiProperty({
    type: 'boolean',
    description: 'Whether transcription is final',
  })
  isFinal: boolean;

  @ApiProperty({
    type: 'string',
    description: 'The provider used (openai or mock)',
    example: 'openai',
  })
  provider: string;
}
