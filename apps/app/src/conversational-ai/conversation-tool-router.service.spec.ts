import { ConversationToolRouterService } from './conversation-tool-router.service';
import { LlmService } from '../llm/llm.service';

describe('ConversationToolRouterService', () => {
  let service: ConversationToolRouterService;
  let llmService: {
    isProviderConfigured: jest.Mock;
    generateToolPlanningResponse: jest.Mock;
  };

  beforeEach(() => {
    llmService = {
      isProviderConfigured: jest.fn(),
      generateToolPlanningResponse: jest.fn(),
    };

    service = new ConversationToolRouterService(
      llmService as unknown as LlmService,
    );
  });

  it('uses model-selected tool routing when OpenAI returns structured output', async () => {
    llmService.isProviderConfigured.mockReturnValue(true);
    llmService.generateToolPlanningResponse.mockResolvedValue({
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

    expect(llmService.generateToolPlanningResponse).toHaveBeenCalled();
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
    llmService.generateToolPlanningResponse.mockResolvedValue({
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

  it('accepts route navigation only for supported screens', async () => {
    llmService.isProviderConfigured.mockReturnValue(true);
    llmService.generateToolPlanningResponse.mockResolvedValue({
      success: true,
      data: {
        response: JSON.stringify({
          toolCalls: [
            {
              name: 'navigate',
              args: { screen: 'Settings' },
            },
          ],
          shouldGenerateResponse: false,
        }),
      },
    });

    const result = await service.routeTurn({
      userMessage: 'open settings',
      sessionMessages: [{ role: 'user', content: 'open settings' }],
      sessionContext: '',
      clientState: {
        onboardingPhase: 'assistant',
        currentRoute: 'Home',
        hasVerifiedIdentity: true,
      },
    });

    expect(result).toEqual({
      toolCalls: [
        {
          name: 'navigate',
          args: { screen: 'Settings' },
        },
      ],
      shouldGenerateResponse: false,
      source: 'model',
    });
  });

  it('accepts backend-owned subscription tools from the planner', async () => {
    llmService.isProviderConfigured.mockReturnValue(true);
    llmService.generateToolPlanningResponse.mockResolvedValue({
      success: true,
      data: {
        response: JSON.stringify({
          toolCalls: [
            {
              name: 'get_allowed_languages',
              args: {},
            },
          ],
          shouldGenerateResponse: true,
        }),
      },
    });

    const result = await service.routeTurn({
      userMessage: 'which languages can I use',
      sessionMessages: [{ role: 'user', content: 'which languages can I use' }],
      sessionContext: '',
      clientState: {
        onboardingPhase: 'assistant',
        currentRoute: 'Settings',
        hasVerifiedIdentity: true,
      },
    });

    expect(result).toEqual({
      toolCalls: [
        {
          name: 'get_allowed_languages',
          args: {},
        },
      ],
      shouldGenerateResponse: true,
      source: 'model',
    });
  });

  it('accepts backend-owned telehealth tools from the planner', async () => {
    llmService.isProviderConfigured.mockReturnValue(true);
    llmService.generateToolPlanningResponse.mockResolvedValue({
      success: true,
      data: {
        response: JSON.stringify({
          toolCalls: [
            {
              name: 'check_symptoms',
              args: {
                symptoms: 'I have a fever and headache',
              },
            },
          ],
          shouldGenerateResponse: true,
        }),
      },
    });

    const result = await service.routeTurn({
      userMessage: 'I have a fever and headache',
      sessionMessages: [
        { role: 'user', content: 'I have a fever and headache' },
      ],
      sessionContext: '',
      clientState: {
        onboardingPhase: 'assistant',
        currentRoute: 'Home',
        hasVerifiedIdentity: true,
      },
    });

    expect(result).toEqual({
      toolCalls: [
        {
          name: 'check_symptoms',
          args: {
            symptoms: 'I have a fever and headache',
          },
        },
      ],
      shouldGenerateResponse: true,
      source: 'model',
    });
  });
});
