import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';

export type NameField = 'firstName' | 'lastName' | 'middleName';

export class SaveNameAsTextDTO {
  @ApiProperty({ enum: ['firstName', 'lastName', 'middleName'] })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    const normalized = value.replace(/[^a-zA-Z]/g, '').toLowerCase();

    if (normalized === 'lastname') return 'lastName';
    if (normalized === 'middlename') return 'middleName';
    return 'firstName';
  })
  @IsIn(['firstName', 'lastName', 'middleName'])
  nameType: NameField;
}
