import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessChunkDto {
  @ApiProperty({ description: 'Session identifier' })
  @IsString()
  sessionId: string;

  @ApiProperty({ description: 'Base64-encoded WAV or audio chunk' })
  @IsString()
  audioBase64: string;

  @ApiProperty({ description: 'Sample rate (Hz)', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sampleRate?: number;
}
