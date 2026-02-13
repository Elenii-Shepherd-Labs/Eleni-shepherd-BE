import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TapToListenDto {
  @ApiProperty({ description: 'Session identifier' })
  @IsString()
  sessionId: string;
}
