import { ConversationAgentToolExecutorService } from './conversation-agent-tool-executor.service';

describe('ConversationAgentToolExecutorService', () => {
  let service: ConversationAgentToolExecutorService;
  let subscriptionService: {
    getUserTier: jest.Mock;
    getAllowedLanguages: jest.Mock;
  };

  beforeEach(() => {
    subscriptionService = {
      getUserTier: jest.fn().mockResolvedValue('free'),
      getAllowedLanguages: jest.fn().mockReturnValue(['en']),
    };

    service = new ConversationAgentToolExecutorService(
      subscriptionService as never,
    );
  });

  it('adds navigation before news playback when the route is not already active', async () => {
    const result = await service.executeToolCalls(
      [
        {
          name: 'read_news',
          args: { category: 'news', openScreen: true },
        },
      ],
      {
        clientState: {
          currentRoute: 'Home',
        },
      },
    );

    expect(result.actions).toEqual([
      { type: 'navigate', screen: 'News' },
      { type: 'read_news', category: 'news' },
    ]);
    expect(result.actionAcknowledgement).toBe(
      'Opening news and reading the latest headlines.',
    );
  });

  it('avoids duplicate navigation when the target screen is already open', async () => {
    const result = await service.executeToolCalls(
      [
        {
          name: 'play_radio',
          args: { genre: 'Jazz', openScreen: true },
        },
      ],
      {
        clientState: {
          currentRoute: 'Radio',
        },
      },
    );

    expect(result.actions).toEqual([{ type: 'play_radio', genre: 'Jazz' }]);
    expect(result.actionAcknowledgement).toBe(
      'Opening radio and tuning into Jazz stations.',
    );
  });

  it('emits route navigation for supported direct screen requests', async () => {
    const result = await service.executeToolCalls(
      [
        {
          name: 'navigate',
          args: { screen: 'Settings' },
        },
      ],
      {
        clientState: {
          currentRoute: 'Home',
        },
      },
    );

    expect(result.actions).toEqual([{ type: 'navigate', screen: 'Settings' }]);
    expect(result.actionAcknowledgement).toBe('Opening settings now.');
    expect(result.toolExecutionContext).toContain('navigate to Settings');
  });

  it('returns backend-only subscription context without client actions', async () => {
    subscriptionService.getUserTier.mockResolvedValue('subscribed');
    subscriptionService.getAllowedLanguages.mockReturnValue(['en', 'yo']);

    const result = await service.executeToolCalls(
      [
        {
          name: 'get_subscription_status',
          args: {},
        },
      ],
      {
        userId: 'user-123',
      },
    );

    expect(result.actions).toEqual([]);
    expect(result.actionAcknowledgement).toBe(
      'Checking your subscription details now.',
    );
    expect(result.toolExecutionContext).toContain('subscription tier is subscribed');
    expect(result.toolExecutionContext).toContain('English');
    expect(result.toolExecutionContext).toContain('Yoruba');
  });

  it('emits tester feedback actions through the shared executor', async () => {
    const result = await service.executeToolCalls([
      {
        name: 'open_tester_feedback',
        args: {},
      },
    ]);

    expect(result.actions).toEqual([{ type: 'open_tester_feedback' }]);
    expect(result.actionAcknowledgement).toBe('Opening tester feedback now.');
  });
});
