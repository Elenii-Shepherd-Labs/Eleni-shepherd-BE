import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationalAiController } from './conversational-ai.controller';
import { LlmModule } from '../llm/llm.module';
import { ConversationAgentService } from './conversation-agent.service';
import { ConversationCheckpointService } from './conversation-checkpoint.service';
import { ConversationToolRouterService } from './conversation-tool-router.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ConversationAgentToolExecutorService } from './conversation-agent-tool-executor.service';
import { TelehealthModule } from '../telehealth/telehealth.module';

@Module({
  imports: [LlmModule, SubscriptionModule, TelehealthModule],
  providers: [
    ConversationService,
    ConversationAgentService,
    ConversationCheckpointService,
    ConversationToolRouterService,
    ConversationAgentToolExecutorService,
  ],
  controllers: [ConversationalAiController],
})
export class ConversationalAiModule {}
