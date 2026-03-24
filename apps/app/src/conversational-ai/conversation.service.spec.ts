import { ConversationService } from './conversation.service';
import { ConversationAgentService } from './conversation-agent.service';

describe('ConversationService', () => {
  let service: ConversationService;
  let cacheStore: Map<string, unknown>;
  let cacheManager: {
    get: jest.Mock<Promise<unknown>, [string]>;
    set: jest.Mock<Promise<void>, [string, unknown]>;
    del: jest.Mock<Promise<void>, [string]>;
  };
  let conversationAgentService: {
    runTurn: jest.Mock;
    deleteThreadState: jest.Mock;
  };

  beforeEach(() => {
    cacheStore = new Map();
    cacheManager = {
      get: jest.fn(async (key: string) => cacheStore.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        cacheStore.set(key, value);
      }),
      del: jest.fn(async (key: string) => {
        cacheStore.delete(key);
      }),
    };

    conversationAgentService = {
      runTurn: jest.fn(),
      deleteThreadState: jest.fn(),
    };

    service = new ConversationService(
      conversationAgentService as unknown as ConversationAgentService,
      cacheManager as never,
    );
  });

  it('persists user and assistant messages around the agent turn', async () => {
    await service.initializeSession('session-1', 'user-1');

    conversationAgentService.runTurn.mockResolvedValue({
      response: 'Here are the latest headlines.',
      actions: [
        { type: 'navigate', screen: 'News' },
        { type: 'read_news', category: 'news' },
      ],
      agent: {
        mode: 'assistant',
        workflow: 'assistant',
        currentRoute: 'Home',
        shouldKeepListening: true,
      },
    });

    const response = await service.processMessage(
      'session-1',
      'read the news',
      {
        currentRoute: 'Home',
        onboardingPhase: 'assistant',
        hasVerifiedIdentity: true,
        isAlwaysListen: true,
      },
      'User prefers short updates.',
    );

    expect(conversationAgentService.runTurn).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      userMessage: 'read the news',
      sessionMessages: [{ role: 'user', content: 'read the news' }],
      sessionContext: '',
      clientState: {
        currentRoute: 'Home',
        onboardingPhase: 'assistant',
        hasVerifiedIdentity: true,
        isAlwaysListen: true,
      },
      extraContext: 'User prefers short updates.',
    });

    expect(response.success).toBe(true);
    expect(response.data).toEqual({
      response: 'Here are the latest headlines.',
      sessionId: 'session-1',
      actions: [
        { type: 'navigate', screen: 'News' },
        { type: 'read_news', category: 'news' },
      ],
      agent: {
        mode: 'assistant',
        workflow: 'assistant',
        currentRoute: 'Home',
        shouldKeepListening: true,
      },
    });

    const storedSession = cacheStore.get(
      'conversation:session:session-1',
    ) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(storedSession.messages).toEqual([
      { role: 'user', content: 'read the news' },
      { role: 'assistant', content: 'Here are the latest headlines.' },
    ]);
  });

  it('keeps only the last twenty messages after processing a turn', async () => {
    const existingMessages = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message-${index + 1}`,
    }));

    cacheStore.set('conversation:session:session-trim', {
      sessionId: 'session-trim',
      userId: 'user-1',
      messages: existingMessages,
      context: 'Existing session context.',
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      interrupted: false,
    });

    conversationAgentService.runTurn.mockResolvedValue({
      response: 'Fresh response',
      actions: [],
      agent: {
        mode: 'assistant',
        workflow: 'assistant',
        currentRoute: 'Home',
        shouldKeepListening: false,
      },
    });

    await service.processMessage('session-trim', 'new message');

    expect(conversationAgentService.runTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
      }),
    );

    const storedSession = cacheStore.get(
      'conversation:session:session-trim',
    ) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(storedSession.messages).toHaveLength(20);
    expect(storedSession.messages[0]).toEqual({
      role: 'user',
      content: 'message-3',
    });
    expect(storedSession.messages[18]).toEqual({
      role: 'user',
      content: 'new message',
    });
    expect(storedSession.messages[19]).toEqual({
      role: 'assistant',
      content: 'Fresh response',
    });
  });

  it('clears cached session data and graph state when ending a session', async () => {
    await service.initializeSession('session-end', 'user-1');

    const response = await service.endSession('session-end');

    expect(response.success).toBe(true);
    expect(cacheStore.has('conversation:session:session-end')).toBe(false);
    expect(conversationAgentService.deleteThreadState).toHaveBeenCalledWith(
      'session-end',
    );
  });
});
