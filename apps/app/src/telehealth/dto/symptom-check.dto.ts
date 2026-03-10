import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SymptomCheckDto {
    @ApiProperty({
        description:
            'A plain-text description of the symptoms the user is experiencing',
        example:
            'I have had a headache and fever for 3 days with mild chest pain.',
    })
    @IsString()
    @IsNotEmpty()
    symptoms: string;

    @ApiPropertyOptional({
        description: 'Optional user ID for personalising the response',
        example: 'user-123',
    })
    @IsOptional()
    @IsString()
    userId?: string;
}
