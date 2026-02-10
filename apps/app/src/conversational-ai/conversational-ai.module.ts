import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationalAiController } from './conversational-ai.controller';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  providers: [ConversationService],
  controllers: [ConversationalAiController],
})
export class ConversationalAiModule {}
