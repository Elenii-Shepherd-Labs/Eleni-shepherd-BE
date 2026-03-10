import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export enum ReminderType {
    MEDICATION = 'medication',
    APPOINTMENT = 'appointment',
    OTHER = 'other',
}

export class CreateReminderDto {
    @ApiProperty({
        description: 'The ID of the user who owns this reminder',
        example: 'user-123',
    })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({
        description: 'Label / title of the reminder',
        example: 'Malaria Prophylaxis',
    })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({
        description: 'Type of reminder',
        enum: ReminderType,
        example: ReminderType.MEDICATION,
    })
    @IsEnum(ReminderType)
    type: ReminderType;

    @ApiProperty({
        description: 'Time of the reminder in HH:MM format (24-hour)',
        example: '14:00',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{2}:\d{2}$/, { message: 'time must be in HH:MM format' })
    time: string;

    @ApiPropertyOptional({
        description: 'Optional notes about the reminder',
        example: 'Take with food',
    })
    @IsOptional()
    @IsString()
    notes?: string;
}
