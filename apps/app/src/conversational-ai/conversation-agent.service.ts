import { Injectable } from '@nestjs/common';
import {
  Annotation,
  END,
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
  ConversationToolCall,
} from './interfaces/conversation-agent.interface';
import {
  buildAgentState,
  buildEffectiveContext,
} from './conversation-agent-context';
import { ConversationCheckpointService } from './conversation-checkpoint.service';
import { executeConversationToolCalls } from './conversation-agent-tools';
import { ConversationToolRouterService } from './conversation-tool-router.service';

const ConversationGraphState = Annotation.Root({
  sessionId: Annotation<string>(),
  userMessage: Annotation<string>(),
  sessionMessages: Annotation<Message[]>(),
  sessionContext: Annotation<string>(),
  clientState: Annotation<ConversationClientState | undefined>(),
  extraContext: Annotation<string | undefined>(),
  toolCalls: Annotation<ConversationToolCall[]>(),
  actions: Annotation<ConversationClientAction[]>(),
  actionAcknowledgement: Annotation<string | null>(),
  toolExecutionContext: Annotation<string | null>(),
  shouldGenerateResponse: Annotation<boolean>(),
  responseText: Annotation<string>(),
  agentState: Annotation<ConversationAgentState>(),
});

type ConversationGraphStateType = typeof ConversationGraphState.State;

@Injectable()
export class ConversationAgentService {
  private readonly graph: ReturnType<ConversationAgentService['buildGraph']>;

  constructor(
    private readonly llmService: LlmService,
    private readonly checkpointService: ConversationCheckpointService,
    private readonly conversationToolRouterService: ConversationToolRouterService,
  ) {
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    return new StateGraph(ConversationGraphState)
      .addNode('plan_turn', async (state) => this.planTurn(state))
      .addNode('execute_tools', async (state) => this.executeTools(state))
      .addNode('generate_response', async (state) =>
        this.generateResponse(state),
      )
      .addNode('finalize_turn', async (state) => this.finalizeTurn(state))
      .addEdge(START, 'plan_turn')
      .addEdge('plan_turn', 'execute_tools')
      .addConditionalEdges('execute_tools', (state) =>
        state.shouldGenerateResponse ? 'generate_response' : 'finalize_turn',
      )
      .addEdge('generate_response', 'finalize_turn')
      .addEdge('finalize_turn', END)
      .compile({ checkpointer: this.checkpointService });
  }

  async runTurn(input: {
    sessionId: string;
    userMessage: string;
    sessionMessages: Message[];
    sessionContext: string;
    clientState?: ConversationClientState;
    extraContext?: string;
  }): Promise<ConversationAgentResult> {
    const result = (await this.graph.invoke(input, {
      configurable: { thread_id: input.sessionId },
    })) as ConversationGraphStateType;

    return {
      response:
        result.responseText ||
        'I apologize, but I could not generate a response.',
      actions: result.actions || [],
      agent: result.agentState,
    };
  }

  async deleteThreadState(sessionId: string) {
    await this.checkpointService.deleteThread(sessionId);
  }

  private async planTurn(state: ConversationGraphStateType) {
    const routingDecision = await this.conversationToolRouterService.routeTurn({
      userMessage: state.userMessage,
      sessionMessages: state.sessionMessages,
      sessionContext: state.sessionContext,
      clientState: state.clientState,
      extraContext: state.extraContext,
    });

    return {
      toolCalls: routingDecision.toolCalls,
      shouldGenerateResponse: routingDecision.shouldGenerateResponse,
      agentState: buildAgentState(state.clientState),
    };
  }

  private async executeTools(state: ConversationGraphStateType) {
    return executeConversationToolCalls(
      state.toolCalls || [],
      state.clientState,
    );
  }

  private async generateResponse(state: ConversationGraphStateType) {
    const aiResponseResp = await this.llmService.generateResponse(
      state.sessionMessages,
      buildEffectiveContext(
        state.sessionContext,
        state.clientState,
        state.extraContext,
        state.toolExecutionContext,
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
