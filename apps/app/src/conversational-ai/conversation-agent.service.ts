import { Injectable } from '@nestjs/common';
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
import {
  buildActionAcknowledgement,
  buildAgentState,
  buildEffectiveContext,
  deriveClientActions,
  shouldShortCircuitToActionResponse,
} from './conversation-agent-planner';

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

  private async planTurn(state: ConversationGraphStateType) {
    const actions = deriveClientActions(state.userMessage, state.clientState);
    const actionAcknowledgement = buildActionAcknowledgement(actions);

    return {
      actions,
      actionAcknowledgement,
      shouldGenerateResponse: !shouldShortCircuitToActionResponse(
        state.userMessage,
        actions,
      ),
      agentState: buildAgentState(state.clientState),
    };
  }

  private async generateResponse(state: ConversationGraphStateType) {
    const aiResponseResp = await this.llmService.generateResponse(
      state.sessionMessages,
      buildEffectiveContext(
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
      agentState: state.agentState || buildAgentState(state.clientState),
    };
  }
}
