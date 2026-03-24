import { executeConversationToolCalls } from './conversation-agent-tools';

describe('executeConversationToolCalls', () => {
  it('adds navigation before news playback when the route is not already active', () => {
    const result = executeConversationToolCalls(
      [
        {
          name: 'read_news',
          args: { category: 'news', openScreen: true },
        },
      ],
      {
        currentRoute: 'Home',
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

  it('avoids duplicate navigation when the target screen is already open', () => {
    const result = executeConversationToolCalls(
      [
        {
          name: 'play_radio',
          args: { genre: 'Jazz', openScreen: true },
        },
      ],
      {
        currentRoute: 'Radio',
      },
    );

    expect(result.actions).toEqual([{ type: 'play_radio', genre: 'Jazz' }]);
    expect(result.actionAcknowledgement).toBe(
      'Opening radio and tuning into Jazz stations.',
    );
  });

  it('emits route navigation for supported direct screen requests', () => {
    const result = executeConversationToolCalls(
      [
        {
          name: 'navigate',
          args: { screen: 'Settings' },
        },
      ],
      {
        currentRoute: 'Home',
      },
    );

    expect(result.actions).toEqual([{ type: 'navigate', screen: 'Settings' }]);
    expect(result.actionAcknowledgement).toBe('Opening settings now.');
    expect(result.toolExecutionContext).toContain('navigate to Settings');
    expect(result.toolExecutionContext).toContain('navigate:Settings');
  });
});
