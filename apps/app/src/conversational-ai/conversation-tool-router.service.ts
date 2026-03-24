import { Injectable, Logger } from '@nestjs/common';
import { Message } from '../llm/dto';
import { LlmService } from '../llm/llm.service';
import {
  ConversationClientState,
  ConversationToolCall,
  ConversationToolRoutingDecision,
} from './interfaces/conversation-agent.interface';
import {
  deriveFallbackToolCalls,
  shouldFallbackToToolOnlyResponse,
} from './conversation-agent-planner';

type ParsedToolRoutingResponse = {
  toolCalls: ConversationToolCall[];
  shouldGenerateResponse: boolean;
};

const conversationToolRoutingSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    toolCalls: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            enum: [
              'navigate',
              'play_radio',
              'read_news',
              'vision_scan',
              'set_listen_mode',
              'stop_audio',
              'start_google_auth',
            ],
          },
          args: {
            type: 'object',
            additionalProperties: false,
            properties: {
              screen: { type: 'string' },
              genre: { type: 'string' },
              category: { type: 'string' },
              openScreen: { type: 'boolean' },
              enabled: { type: 'boolean' },
            },
          },
        },
        required: ['name', 'args'],
      },
    },
    shouldGenerateResponse: { type: 'boolean' },
  },
  required: ['toolCalls', 'shouldGenerateResponse'],
} as const;

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

    const structuredResponse = await this.llmService.generateStructuredResponse(
      this.buildSystemPrompt(),
      this.buildUserPrompt(input),
      {
        schemaName: 'conversation_tool_routing',
        schema: conversationToolRoutingSchema,
        model: 'gpt-4o-mini',
      },
    );

    const responseText = structuredResponse.data?.response;
    if (!structuredResponse.success || typeof responseText !== 'string') {
      this.logger.warn(
        'Structured tool routing unavailable. Falling back to deterministic planner.',
      );
      return this.buildFallbackDecision(input.userMessage, input.clientState);
    }

    const parsed = this.parseToolRoutingResponse(responseText);
    if (!parsed) {
      this.logger.warn(
        'Structured tool routing could not be parsed. Falling back to deterministic planner.',
      );
      return this.buildFallbackDecision(input.userMessage, input.clientState);
    }

    return {
      ...parsed,
      source: 'model',
    };
  }

  private buildSystemPrompt() {
    return [
      'You are the tool router for a voice-first accessibility assistant.',
      'Return JSON only with this exact shape:',
      '{"toolCalls":[{"name":"navigate","args":{"screen":"News"}}],"shouldGenerateResponse":false}',
      'Use only these tool names: navigate, play_radio, read_news, vision_scan, set_listen_mode, stop_audio, start_google_auth.',
      'Rules:',
      '- Choose zero or more tool calls based on the latest user request.',
      '- Set shouldGenerateResponse to false when the selected tools fully satisfy a short command.',
      '- Set shouldGenerateResponse to true when the user needs explanation, conversation, or a spoken answer in addition to any tool execution.',
      '- Never invent tool names or arguments.',
      '- For play_radio and read_news, you may include openScreen: true when the app should navigate first.',
      '- For pre-auth sign-in requests, use start_google_auth.',
    ].join('\n');
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
    userMessage: string,
    clientState?: ConversationClientState,
  ): ConversationToolRoutingDecision {
    const toolCalls = deriveFallbackToolCalls(userMessage, clientState);
    return {
      toolCalls,
      shouldGenerateResponse: !shouldFallbackToToolOnlyResponse(
        userMessage,
        toolCalls,
      ),
      source: 'fallback',
    };
  }

  private parseToolRoutingResponse(
    responseText: string,
  ): ParsedToolRoutingResponse | null {
    const jsonText = this.extractJsonObject(responseText);
    if (!jsonText) {
      return null;
    }

    try {
      const parsed = JSON.parse(jsonText) as {
        toolCalls?: unknown[];
        shouldGenerateResponse?: unknown;
      };

      const toolCalls = Array.isArray(parsed.toolCalls)
        ? parsed.toolCalls
            .map((toolCall) => this.sanitizeToolCall(toolCall))
            .filter((toolCall): toolCall is ConversationToolCall =>
              Boolean(toolCall),
            )
        : [];

      const shouldGenerateResponse =
        typeof parsed.shouldGenerateResponse === 'boolean'
          ? parsed.shouldGenerateResponse
          : toolCalls.length === 0;

      return {
        toolCalls,
        shouldGenerateResponse,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse structured tool routing JSON: ${error}`);
      return null;
    }
  }

  private extractJsonObject(text: string) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start === -1 || end === -1 || end < start) {
      return null;
    }

    return text.slice(start, end + 1);
  }

  private sanitizeToolCall(value: unknown): ConversationToolCall | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const toolCall = value as { name?: unknown; args?: Record<string, unknown> };
    const args = toolCall.args && typeof toolCall.args === 'object' ? toolCall.args : {};

    switch (toolCall.name) {
      case 'navigate':
        return typeof args.screen === 'string'
          ? { name: 'navigate', args: { screen: args.screen } }
          : null;
      case 'play_radio':
        return {
          name: 'play_radio',
          args: {
            genre: typeof args.genre === 'string' ? args.genre : undefined,
            openScreen:
              typeof args.openScreen === 'boolean' ? args.openScreen : undefined,
          },
        };
      case 'read_news':
        return {
          name: 'read_news',
          args: {
            category:
              typeof args.category === 'string' ? args.category : undefined,
            openScreen:
              typeof args.openScreen === 'boolean' ? args.openScreen : undefined,
          },
        };
      case 'vision_scan':
        return { name: 'vision_scan', args: {} };
      case 'set_listen_mode':
        return typeof args.enabled === 'boolean'
          ? { name: 'set_listen_mode', args: { enabled: args.enabled } }
          : null;
      case 'stop_audio':
        return { name: 'stop_audio', args: {} };
      case 'start_google_auth':
        return { name: 'start_google_auth', args: {} };
      default:
        return null;
    }
  }
}
