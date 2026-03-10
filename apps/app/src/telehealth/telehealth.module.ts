import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { TelehealthController } from './telehealth.controller';
import { TelehealthService } from './telehealth.service';
import { Reminder, ReminderSchema } from './entities/reminder.schema';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Reminder.name, schema: ReminderSchema },
    ]),
    LlmModule, // Provides LlmService for symptom checker (OpenAI + Anthropic)
  ],
  controllers: [TelehealthController],
  providers: [TelehealthService],
  exports: [TelehealthService],
})
export class TelehealthModule { }
