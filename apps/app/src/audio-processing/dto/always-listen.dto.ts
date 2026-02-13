import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean } from 'class-validator';

export class AlwaysListenDto {
  @ApiProperty({ description: 'Session identifier' })
  @IsString()
  sessionId: string;

  @ApiProperty({ description: 'Enable or disable always-listen' })
  @IsBoolean()
  enabled: boolean;
}
