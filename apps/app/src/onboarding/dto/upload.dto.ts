// This DTO is a placeholder for Swagger Documentation
import { ApiProperty } from '@nestjs/swagger';

export class UploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: true,
    example: 'firstname.mp3',
  })
  audio: Express.Multer.File;
}
