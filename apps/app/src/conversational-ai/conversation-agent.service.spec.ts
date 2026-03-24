import { ConversationAgentService } from './conversation-agent.service';
import { LlmService } from '../llm/llm.service';
import { Message } from '../llm/dto';
import { ConversationCheckpointService } from './conversation-checkpoint.service';
import { MemorySaver } from '@langchain/langgraph';
import { ConversationToolRouterService } from './conversation-tool-router.service';
import { ConversationAgentToolExecutorService } from './conversation-agent-tool-executor.service';

describe('ConversationAgentService', () => {
  let service: ConversationAgentService;
  let llmService: { generateResponse: jest.Mock };
  let checkpointService: MemorySaver;
  let conversationToolRouterService: { routeTurn: jest.Mock };
  let conversationAgentToolExecutorService: { executeToolCalls: jest.Mock };

  beforeEach(() => {
    llmService = {
      generateResponse: jest.fn(),
    };
    checkpointService = new MemorySaver();
    conversationToolRouterService = {
      routeTurn: jest.fn(),
    };
    conversationAgentToolExecutorService = {
      executeToolCalls: jest.fn(),
    };

    service = new ConversationAgentService(
      llmService as unknown as LlmService,
      checkpointService as unknown as ConversationCheckpointService,
      conversationToolRouterService as unknown as ConversationToolRouterService,
      conversationAgentToolExecutorService as unknown as ConversationAgentToolExecutorService,
    );
  });

  it('returns a Google auth action during pre-auth onboarding', async () => {
    conversationToolRouterService.routeTurn.mockResolvedValue({
      toolCalls: [{ name: 'start_google_auth', args: {} }],
      shouldGenerateResponse: false,
      source: 'model',
    });
    conversationAgentToolExecutorService.executeToolCalls.mockResolvedValue({
      actions: [{ type: 'start_google_auth' }],
      actionAcknowledgement: 'Okay. Opening Google sign in now.',
      toolExecutionContext: 'Tool outcomes: start Google sign in.',
    });

    const result = await service.runTurn({
      sessionId: 'session-pre-auth',
      userMessage: 'sign me in with google',
      sessionMessages: [{ role: 'user', content: 'sign me in with google' }],
      sessionContext: '',
      clientState: {
        onboardingPhase: 'pre_auth',
        hasVerifiedIdentity: false,
        currentRoute: 'Onboarding',
      },
    });

    expect(llmService.generateResponse).not.toHaveBeenCalled();
    expect(result.actions).toEqual([{ type: 'start_google_auth' }]);
    expect(result.response).toBe('Okay. Opening Google sign in now.');
    expect(result.agent).toEqual({
      mode: 'onboarding',
      workflow: 'pre_auth',
      currentRoute: 'Onboarding',
      shouldKeepListening: true,
    });
  });

  it('uses the llm path for non-command turns', async () => {
    conversationToolRouterService.routeTurn.mockResolvedValue({
      toolCalls: [],
      shouldGenerateResponse: true,
      source: 'model',
    });
    conversationAgentToolExecutorService.executeToolCalls.mockResolvedValue({
      actions: [],
      actionAcknowledgement: null,
      toolExecutionContext: null,
    });
    llmService.generateResponse.mockResolvedValue({
      data: { response: 'Here is what I found for you.' },
    });

    const sessionMessages: Message[] = [
      { role: 'assistant', content: 'How can I help?' },
      { role: 'user', content: 'Tell me about obstacle detection.' },
    ];

    const result = await service.runTurn({
      sessionId: 'session-llm',
      userMessage: 'Tell me about obstacle detection.',
      sessionMessages,
      sessionContext: 'User prefers concise answers.',
      clientState: {
        onboardingPhase: 'assistant',
        hasVerifiedIdentity: true,
        isAlwaysListen: false,
        currentRoute: 'Home',
      },
    });

    expect(llmService.generateResponse).toHaveBeenCalledWith(
      sessionMessages,
      expect.stringContaining('Current mobile route: Home.'),
    );
    expect(result.actions).toEqual([]);
    expect(result.response).toBe('Here is what I found for you.');
    expect(result.agent).toEqual({
      mode: 'assistant',
      workflow: 'assistant',
      currentRoute: 'Home',
      shouldKeepListening: false,
    });
  });

  it('derives route-aware media actions without calling the llm', async () => {
    conversationToolRouterService.routeTurn.mockResolvedValue({
      toolCalls: [
        {
          name: 'read_news',
          args: { category: 'news', openScreen: true },
        },
      ],
      shouldGenerateResponse: false,
      source: 'model',
    });
    conversationAgentToolExecutorService.executeToolCalls.mockResolvedValue({
      actions: [
        { type: 'navigate', screen: 'News' },
        { type: 'read_news', category: 'news' },
      ],
      actionAcknowledgement: 'Opening news and reading the latest headlines.',
      toolExecutionContext:
        'Tool outcomes: read news for news. Current route before execution: Home.',
    });

    const result = await service.runTurn({
      sessionId: 'session-news',
      userMessage: 'read the news',
      sessionMessages: [{ role: 'user', content: 'read the news' }],
      sessionContext: '',
      clientState: {
        onboardingPhase: 'assistant',
        hasVerifiedIdentity: true,
        isAlwaysListen: true,
        currentRoute: 'Home',
      },
    });

    expect(llmService.generateResponse).not.toHaveBeenCalled();
    expect(result.actions).toEqual([
      { type: 'navigate', screen: 'News' },
      { type: 'read_news', category: 'news' },
    ]);
    expect(result.agent).toEqual({
      mode: 'assistant',
      workflow: 'assistant',
      currentRoute: 'Home',
      shouldKeepListening: true,
    });
  });

  it('passes tool execution context into the response generation path', async () => {
    conversationToolRouterService.routeTurn.mockResolvedValue({
      toolCalls: [
        {
          name: 'navigate',
          args: { screen: 'Settings' },
        },
      ],
      shouldGenerateResponse: true,
      source: 'model',
    });
    conversationAgentToolExecutorService.executeToolCalls.mockResolvedValue({
      actions: [{ type: 'navigate', screen: 'Settings' }],
      actionAcknowledgement: 'Opening settings now.',
      toolExecutionContext:
        'Tool outcomes: navigate to Settings. Current route before execution: Home.',
    });
    llmService.generateResponse.mockResolvedValue({
      data: { response: 'Opening settings. You can review your account there.' },
    });

    const result = await service.runTurn({
      sessionId: 'session-settings',
      userMessage: 'open settings and tell me what I can do there',
      sessionMessages: [
        {
          role: 'user',
          content: 'open settings and tell me what I can do there',
        },
      ],
      sessionContext: 'User prefers direct spoken guidance.',
      clientState: {
        onboardingPhase: 'assistant',
        hasVerifiedIdentity: true,
        isAlwaysListen: false,
        currentRoute: 'Home',
      },
    });

    expect(llmService.generateResponse).toHaveBeenCalledWith(
      expect.any(Array),
      expect.stringContaining(
        'Recent client tool execution: Tool outcomes: navigate to Settings. Current route before execution: Home.',
      ),
    );
    expect(result.actions).toEqual([{ type: 'navigate', screen: 'Settings' }]);
    expect(result.response).toBe(
      'Opening settings. You can review your account there.',
    );
  });

  it('passes the session user id into backend-owned tool execution', async () => {
    conversationToolRouterService.routeTurn.mockResolvedValue({
      toolCalls: [
        {
          name: 'get_subscription_status',
          args: {},
        },
      ],
      shouldGenerateResponse: true,
      source: 'model',
    });
    conversationAgentToolExecutorService.executeToolCalls.mockResolvedValue({
      actions: [],
      actionAcknowledgement: 'Checking your subscription details now.',
      toolExecutionContext:
        'Tool outcomes: subscription tier is subscribed with access to English, Yoruba.',
    });
    llmService.generateResponse.mockResolvedValue({
      data: {
        response: 'You are on the subscribed tier and can use English and Yoruba.',
      },
    });

    const result = await service.runTurn({
      sessionId: 'session-subscription',
      userId: 'user-123',
      userMessage: 'what languages can I use',
      sessionMessages: [{ role: 'user', content: 'what languages can I use' }],
      sessionContext: '',
      clientState: {
        onboardingPhase: 'assistant',
        hasVerifiedIdentity: true,
        currentRoute: 'Settings',
      },
    });

    expect(conversationAgentToolExecutorService.executeToolCalls).toHaveBeenCalledWith(
      [{ name: 'get_subscription_status', args: {} }],
      {
        clientState: {
          onboardingPhase: 'assistant',
          hasVerifiedIdentity: true,
          currentRoute: 'Settings',
        },
        userId: 'user-123',
      },
    );
    expect(result.actions).toEqual([]);
    expect(result.response).toBe(
      'You are on the subscribed tier and can use English and Yoruba.',
    );
  });

  it('delegates thread cleanup to the checkpoint service', async () => {
    const deleteThreadSpy = jest.spyOn(checkpointService, 'deleteThread');

    await service.deleteThreadState('session-cleanup');

    expect(deleteThreadSpy).toHaveBeenCalledWith('session-cleanup');
  });
});
