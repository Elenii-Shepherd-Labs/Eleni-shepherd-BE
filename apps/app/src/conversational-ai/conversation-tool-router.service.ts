import { Injectable, Logger } from '@nestjs/common';
import { Message } from '../llm/dto';
import { LlmService } from '../llm/llm.service';
import {
  ConversationClientState,
  ConversationToolRoutingDecision,
} from './interfaces/conversation-agent.interface';
import {
  buildConversationRoutingSystemPrompt,
  buildConversationRoutingToolDefinition,
  parseConversationRoutingArguments,
} from './conversation-agent-tool-catalog';

@Injectable()
export class ConversationToolRouterService {
  private readonly logger = new Logger(ConversationToolRouterService.name);

  constructor(private readonly llmService: LlmService) {}

  async routeTurn(input: {
    userMessage: string;
    sessionMessages: Message[];
    sessionContext: string;
    clientState?: ConversationClientState;
    extraContext?: string;
  }): Promise<ConversationToolRoutingDecision> {
    if (!this.llmService.isProviderConfigured()) {
      return this.buildFallbackDecision(input.userMessage, input.clientState);
    }

    const toolDefinition = buildConversationRoutingToolDefinition();
    const structuredResponse = await this.llmService.generateToolPlanningResponse(
      buildConversationRoutingSystemPrompt(),
      this.buildUserPrompt(input),
      {
        toolName: toolDefinition.name,
        toolDescription: toolDefinition.description,
        parameters: toolDefinition.parameters,
        model: 'gpt-4o-mini',
      },
    );

    const responseText = structuredResponse.data?.response;
    if (!structuredResponse.success || typeof responseText !== 'string') {
      this.logger.warn(
        'OpenAI tool planning unavailable. Falling back to response-only routing.',
      );
      return this.buildFallbackDecision(input.userMessage, input.clientState);
    }

    const parsed = parseConversationRoutingArguments(responseText);
    if (!parsed) {
      this.logger.warn(
        'OpenAI tool planning arguments could not be parsed. Falling back to response-only routing.',
      );
      return this.buildFallbackDecision(input.userMessage, input.clientState);
    }

    return {
      ...parsed,
      source: 'model',
    };
  }

  private buildUserPrompt(input: {
    userMessage: string;
    sessionMessages: Message[];
    sessionContext: string;
    clientState?: ConversationClientState;
    extraContext?: string;
  }) {
    const recentMessages = input.sessionMessages
      .slice(-6)
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n');

    return [
      `Latest user message: ${input.userMessage}`,
      `Current route: ${input.clientState?.currentRoute || 'unknown'}`,
      `Onboarding phase: ${input.clientState?.onboardingPhase || 'assistant'}`,
      `Has verified identity: ${input.clientState?.hasVerifiedIdentity ? 'yes' : 'no'}`,
      `Always listen enabled: ${input.clientState?.isAlwaysListen ? 'yes' : 'no'}`,
      `Session context: ${input.sessionContext || 'none'}`,
      `Extra context: ${input.extraContext || 'none'}`,
      `Recent messages:\n${recentMessages || 'none'}`,
    ].join('\n');
  }

  private buildFallbackDecision(
    _userMessage: string,
    _clientState?: ConversationClientState,
  ): ConversationToolRoutingDecision {
    return {
      toolCalls: [],
      shouldGenerateResponse: true,
      source: 'fallback',
    };
  }
}
