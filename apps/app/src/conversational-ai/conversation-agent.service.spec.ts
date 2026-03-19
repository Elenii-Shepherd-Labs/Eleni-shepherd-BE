import { ConversationAgentService } from './conversation-agent.service';
import { LlmService } from '../llm/llm.service';
import { Message } from '../llm/dto';

describe('ConversationAgentService', () => {
  let service: ConversationAgentService;
  let llmService: { generateResponse: jest.Mock };

  beforeEach(() => {
    llmService = {
      generateResponse: jest.fn(),
    };

    service = new ConversationAgentService(llmService as unknown as LlmService);
  });

  it('returns a Google auth action during pre-auth onboarding', async () => {
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
});
