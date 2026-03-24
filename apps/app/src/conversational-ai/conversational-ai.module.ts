import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationalAiController } from './conversational-ai.controller';
import { LlmModule } from '../llm/llm.module';
import { ConversationAgentService } from './conversation-agent.service';
import { ConversationCheckpointService } from './conversation-checkpoint.service';
import { ConversationToolRouterService } from './conversation-tool-router.service';

@Module({
  imports: [LlmModule],
  providers: [
    ConversationService,
    ConversationAgentService,
    ConversationCheckpointService,
    ConversationToolRouterService,
  ],
  controllers: [ConversationalAiController],
})
export class ConversationalAiModule {}
