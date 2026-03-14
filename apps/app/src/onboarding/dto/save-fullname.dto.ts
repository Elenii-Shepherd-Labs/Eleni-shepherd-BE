import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SaveFullNameDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj?.firstname)
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj?.lastname)
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj?.middlename)
  middleName?: string;
}
