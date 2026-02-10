import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class SaveNameAsTextDTO {
  @ApiProperty({ enum: ['firstname', 'lastname'] })
  @IsIn(['firstname', 'lastname'])
  nameType: string;
}
