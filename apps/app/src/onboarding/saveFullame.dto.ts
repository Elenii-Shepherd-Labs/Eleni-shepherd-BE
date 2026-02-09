import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SaveFullameDto {
  @ApiProperty()
  @IsString()
  firstname: string;

  @ApiProperty()
  @IsString()
  lastname: string;
}
