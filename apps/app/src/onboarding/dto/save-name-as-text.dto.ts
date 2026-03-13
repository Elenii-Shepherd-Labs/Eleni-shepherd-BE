import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';

export class SaveNameAsTextDTO {
  @ApiProperty({ enum: ['firstName', 'lastName', 'middleName'] })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    const normalized = value.replace(/[^a-zA-Z]/g, '').toLowerCase();

    if (normalized === 'lastname') return 'lastname';
    if (normalized === 'middlename') return 'middlename';
    return 'firstname';
  })
  @IsIn(['firstname', 'lastname', 'middlename'])
  nameType: string;
}
