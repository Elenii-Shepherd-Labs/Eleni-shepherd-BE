import { Injectable, Logger } from '@nestjs/common';
import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { LlmService } from '../llm/llm.service';
import { Message } from '../llm/dto';
import {
  ConversationAgentResult,
  ConversationAgentState,
  ConversationClientAction,
  ConversationClientState,
} from './interfaces/conversation-agent.interface';

const ConversationGraphState = Annotation.Root({
  sessionId: Annotation<string>(),
  userMessage: Annotation<string>(),
  sessionMessages: Annotation<Message[]>(),
  sessionContext: Annotation<string>(),
  clientState: Annotation<ConversationClientState | undefined>(),
  extraContext: Annotation<string | undefined>(),
  actions: Annotation<ConversationClientAction[]>(),
  actionAcknowledgement: Annotation<string | null>(),
  shouldGenerateResponse: Annotation<boolean>(),
  responseText: Annotation<string>(),
  agentState: Annotation<ConversationAgentState>(),
});

type ConversationGraphStateType = typeof ConversationGraphState.State;

@Injectable()
export class ConversationAgentService {
  private readonly logger = new Logger(ConversationAgentService.name);
  private readonly graph = new StateGraph(ConversationGraphState)
    .addNode('plan_turn', async (state) => this.planTurn(state))
    .addNode('generate_response', async (state) =>
      this.generateResponse(state),
    )
    .addNode('finalize_turn', async (state) => this.finalizeTurn(state))
    .addEdge(START, 'plan_turn')
    .addConditionalEdges('plan_turn', (state) =>
      state.shouldGenerateResponse ? 'generate_response' : 'finalize_turn',
    )
    .addEdge('generate_response', 'finalize_turn')
    .addEdge('finalize_turn', END)
    .compile({ checkpointer: new MemorySaver() });

  constructor(private readonly llmService: LlmService) {}

  async runTurn(input: {
    sessionId: string;
    userMessage: string;
    sessionMessages: Message[];
    sessionContext: string;
    clientState?: ConversationClientState;
    extraContext?: string;
  }): Promise<ConversationAgentResult> {
    const result = await this.graph.invoke(input, {
      configurable: { thread_id: input.sessionId },
    });

    return {
      response:
        result.responseText ||
        'I apologize, but I could not generate a response.',
      actions: result.actions || [],
      agent: result.agentState,
    };
  }

  private normalizeUtterance(text: string) {
    return text
      .toLowerCase()
      .replace(/[^\w\s']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasAny(normalized: string, ...phrases: string[]) {
    return phrases.some((phrase) => normalized.includes(phrase));
  }

  private isGoogleAuthIntent(normalized: string) {
    return (
      this.hasAny(
        normalized,
        'sign in',
        'sign me in',
        'log in',
        'log me in',
        'login',
        'continue',
        'open google sign in',
        'help me sign in',
      ) ||
      normalized.startsWith('sign in ') ||
      normalized.startsWith('sign me in ') ||
      normalized.startsWith('log in ') ||
      normalized.startsWith('log me in ')
    );
  }

  private deriveClientActions(
    userMessage: string,
    clientState?: ConversationClientState,
  ): ConversationClientAction[] {
    const normalized = this.normalizeUtterance(userMessage);
    if (!normalized) {
      return [];
    }

    if (
      clientState?.onboardingPhase === 'pre_auth' &&
      !clientState?.hasVerifiedIdentity &&
      this.isGoogleAuthIntent(normalized)
    ) {
      return [{ type: 'start_google_auth' }];
    }

    const actions: ConversationClientAction[] = [];
    const route = clientState?.currentRoute?.trim() || '';

    if (this.hasAny(normalized, 'stop', 'quiet', 'pause')) {
      actions.push({ type: 'stop_audio' });
      return actions;
    }

    if (
      this.hasAny(
        normalized,
        'switch mode',
        'listen mode',
        'always listen',
        'tap to listen',
      )
    ) {
      actions.push({
        type: 'set_listen_mode',
        enabled: this.hasAny(normalized, 'always'),
      });
      return actions;
    }

    if (this.hasAny(normalized, 'settings')) {
      actions.push({ type: 'navigate', screen: 'Settings' });
      return actions;
    }

    if (this.hasAny(normalized, 'home', 'dashboard')) {
      actions.push({ type: 'navigate', screen: 'Home' });
      return actions;
    }

    if (this.hasAny(normalized, 'news', 'headline', 'headlines')) {
      if (this.hasAny(normalized, 'open', 'go', 'navigate')) {
        actions.push({ type: 'navigate', screen: 'News' });
      } else {
        if (route !== 'News') {
          actions.push({ type: 'navigate', screen: 'News' });
        }
        actions.push({ type: 'read_news', category: 'news' });
      }
      return actions;
    }

    if (this.hasAny(normalized, 'radio', 'station', 'music')) {
      if (this.hasAny(normalized, 'open', 'go', 'navigate')) {
        actions.push({ type: 'navigate', screen: 'Radio' });
      } else {
        if (route !== 'Radio') {
          actions.push({ type: 'navigate', screen: 'Radio' });
        }

        let genre = 'Nigeria';
        if (this.hasAny(normalized, 'jazz')) genre = 'Jazz';
        else if (this.hasAny(normalized, 'gospel')) genre = 'Gospel';

        actions.push({ type: 'play_radio', genre });
      }
      return actions;
    }

    if (this.hasAny(normalized, 'scan', 'what is this', 'look at', 'read this')) {
      actions.push({ type: 'vision_scan' });
      return actions;
    }

    if (this.hasAny(normalized, 'navigate', 'walk', 'path', 'ahead', 'route')) {
      actions.push({ type: 'navigate', screen: 'Navigation' });
      return actions;
    }

    return actions;
  }

  private buildActionAcknowledgement(
    actions: ConversationClientAction[],
  ): string | null {
    const primary = actions[0];
    if (!primary) {
      return null;
    }

    switch (primary.type) {
      case 'stop_audio':
        return 'Stopping audio now.';
      case 'set_listen_mode':
        return `Switched to ${
          primary.enabled ? 'always listen' : 'tap to listen'
        } mode.`;
      case 'navigate':
        if (primary.screen === 'Navigation') {
          return 'Opening navigation now.';
        }
        return `Opening ${primary.screen.toLowerCase()} now.`;
      case 'play_radio':
        return `Opening radio and tuning into ${
          primary.genre || 'Nigeria'
        } stations.`;
      case 'read_news':
        return 'Opening news and reading the latest headlines.';
      case 'vision_scan':
        return 'Starting a quick scan now.';
      case 'start_google_auth':
        return 'Okay. Opening Google sign in now.';
      default:
        return null;
    }
  }

  private shouldShortCircuitToActionResponse(
    userMessage: string,
    actions: ConversationClientAction[],
  ) {
    if (actions.length === 0) {
      return false;
    }

    const normalized = this.normalizeUtterance(userMessage);
    const words = normalized.split(' ').filter(Boolean);
    return (
      words.length <= 8 ||
      normalized.startsWith('open ') ||
      normalized.startsWith('go ') ||
      normalized.startsWith('play ') ||
      normalized.startsWith('read ') ||
      normalized.startsWith('scan ') ||
      normalized.startsWith('navigate ') ||
      normalized.startsWith('stop ') ||
      normalized.startsWith('switch ') ||
      normalized.startsWith('sign ') ||
      normalized.startsWith('log ')
    );
  }

  private buildEffectiveContext(
    sessionContext: string,
    clientState?: ConversationClientState,
    extraContext?: string,
  ) {
    const contextParts = [sessionContext];

    if (clientState?.currentRoute) {
      contextParts.push(`Current mobile route: ${clientState.currentRoute}.`);
    }

    if (clientState?.onboardingPhase) {
      contextParts.push(
        `Current onboarding phase: ${clientState.onboardingPhase}.`,
      );
    }

    if (typeof clientState?.hasVerifiedIdentity === 'boolean') {
      contextParts.push(
        `Verified identity present: ${
          clientState.hasVerifiedIdentity ? 'yes' : 'no'
        }.`,
      );
    }

    if (typeof clientState?.isAlwaysListen === 'boolean') {
      contextParts.push(
        `Listen mode: ${
          clientState.isAlwaysListen ? 'always listen' : 'tap to listen'
        }.`,
      );
    }

    if (extraContext) {
      contextParts.push(extraContext);
    }

    return contextParts.filter(Boolean).join('\n');
  }

  private buildAgentState(
    clientState?: ConversationClientState,
  ): ConversationAgentState {
    const workflow = clientState?.onboardingPhase || 'assistant';
    return {
      mode: workflow === 'assistant' ? 'assistant' : 'onboarding',
      workflow,
      currentRoute: clientState?.currentRoute,
      shouldKeepListening:
        workflow === 'pre_auth' ||
        workflow === 'awaiting_name' ||
        Boolean(clientState?.isAlwaysListen),
    };
  }

  private async planTurn(state: ConversationGraphStateType) {
    const actions = this.deriveClientActions(
      state.userMessage,
      state.clientState,
    );
    const actionAcknowledgement = this.buildActionAcknowledgement(actions);

    return {
      actions,
      actionAcknowledgement,
      shouldGenerateResponse: !this.shouldShortCircuitToActionResponse(
        state.userMessage,
        actions,
      ),
      agentState: this.buildAgentState(state.clientState),
    };
  }

  private async generateResponse(state: ConversationGraphStateType) {
    const aiResponseResp = await this.llmService.generateResponse(
      state.sessionMessages,
      this.buildEffectiveContext(
        state.sessionContext,
        state.clientState,
        state.extraContext,
      ),
    );

    const responseText =
      (aiResponseResp.data as { response?: string } | null)?.response ||
      state.actionAcknowledgement ||
      'I apologize, but I could not generate a response.';

    return { responseText };
  }

  private async finalizeTurn(state: ConversationGraphStateType) {
    return {
      responseText:
        state.responseText ||
        state.actionAcknowledgement ||
        'I apologize, but I could not generate a response.',
      actions: state.actions || [],
      agentState: state.agentState || this.buildAgentState(state.clientState),
    };
  }
}
