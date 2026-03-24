import { ConversationToolRouterService } from './conversation-tool-router.service';
import { LlmService } from '../llm/llm.service';

describe('ConversationToolRouterService', () => {
  let service: ConversationToolRouterService;
  let llmService: {
    isProviderConfigured: jest.Mock;
    generateStructuredResponse: jest.Mock;
  };

  beforeEach(() => {
    llmService = {
      isProviderConfigured: jest.fn(),
      generateStructuredResponse: jest.fn(),
    };

    service = new ConversationToolRouterService(
      llmService as unknown as LlmService,
    );
  });

  it('uses model-selected tool routing when OpenAI returns structured output', async () => {
    llmService.isProviderConfigured.mockReturnValue(true);
    llmService.generateStructuredResponse.mockResolvedValue({
      success: true,
      data: {
        response: JSON.stringify({
          toolCalls: [
            {
              name: 'read_news',
              args: { category: 'news', openScreen: true },
            },
          ],
          shouldGenerateResponse: false,
        }),
      },
    });

    const result = await service.routeTurn({
      userMessage: 'read the news',
      sessionMessages: [{ role: 'user', content: 'read the news' }],
      sessionContext: '',
      clientState: {
        onboardingPhase: 'assistant',
        currentRoute: 'Home',
        hasVerifiedIdentity: true,
      },
    });

    expect(llmService.generateStructuredResponse).toHaveBeenCalled();
    expect(result).toEqual({
      toolCalls: [
        {
          name: 'read_news',
          args: { category: 'news', openScreen: true },
        },
      ],
      shouldGenerateResponse: false,
      source: 'model',
    });
  });

  it('falls back to response-only routing when OpenAI is unavailable', async () => {
    llmService.isProviderConfigured.mockReturnValue(false);

    const result = await service.routeTurn({
      userMessage: 'sign me in with google',
      sessionMessages: [{ role: 'user', content: 'sign me in with google' }],
      sessionContext: '',
      clientState: {
        onboardingPhase: 'pre_auth',
        hasVerifiedIdentity: false,
        currentRoute: 'Onboarding',
      },
    });

    expect(result).toEqual({
      toolCalls: [],
      shouldGenerateResponse: true,
      source: 'fallback',
    });
  });

  it('falls back when the structured response is malformed', async () => {
    llmService.isProviderConfigured.mockReturnValue(true);
    llmService.generateStructuredResponse.mockResolvedValue({
      success: true,
      data: {
        response: 'not valid json',
      },
    });

    const result = await service.routeTurn({
      userMessage: 'play jazz radio',
      sessionMessages: [{ role: 'user', content: 'play jazz radio' }],
      sessionContext: '',
      clientState: {
        onboardingPhase: 'assistant',
        currentRoute: 'Home',
        hasVerifiedIdentity: true,
      },
    });

    expect(result).toEqual({
      toolCalls: [],
      shouldGenerateResponse: true,
      source: 'fallback',
    });
  });
});
