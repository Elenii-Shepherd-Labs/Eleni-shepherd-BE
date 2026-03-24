import { ConversationToolCall } from './interfaces/conversation-agent.interface';

type ParsedToolRoutingResponse = {
  toolCalls: ConversationToolCall[];
  shouldGenerateResponse: boolean;
};

export const SUPPORTED_CONVERSATION_SCREENS = [
  'Home',
  'Navigation',
  'Radio',
  'News',
  'Settings',
  'Onboarding',
] as const;

export function buildConversationRoutingSystemPrompt() {
  return [
    'You are the tool router for a voice-first accessibility assistant.',
    'Plan the next app actions for the latest user turn.',
    'Use tools only when they directly match the user intent or the current onboarding workflow.',
    'Prefer supported screens only when routing navigation.',
    `Supported navigation screens: ${SUPPORTED_CONVERSATION_SCREENS.join(', ')}.`,
    'Behavior rules:',
    '- Use navigate when the user asks to open, go to, return to, or leave for a supported screen.',
    '- Use play_radio to start radio playback, optionally with openScreen true when the app should open Radio first.',
    '- Use read_news to read headlines, optionally with openScreen true when the app should open News first.',
    '- Use vision_scan when the user asks to scan, describe, read, or analyze the current view.',
    '- Use set_listen_mode when the user asks to enable or disable always-listen mode.',
    '- Use stop_audio when the user asks to stop speaking, stop playback, mute, or be quiet.',
    '- Use start_google_auth for pre-auth onboarding sign-in requests.',
    '- Use open_tester_feedback only when the user explicitly wants to report a tester issue or send build feedback.',
    '- Use check_tester_updates only when the user explicitly wants to check for a newer tester build.',
    '- Use get_subscription_status when the user asks about plan, tier, subscription access, or account entitlements.',
    '- Use get_allowed_languages when the user asks which languages are available or whether a language is supported.',
    '- Use get_onboarding_status when the user asks whether setup is complete, whether their profile is ready, or what onboarding details are still missing.',
    '- Use get_health_reminders when the user asks about their medications, appointments, reminders, or what they need to take later.',
    '- Use check_symptoms when the user describes symptoms and wants health guidance. Pass the symptoms text in the symptoms argument.',
    '- Use create_health_reminder when the user wants to add a medication, appointment, or health reminder. Pass title and time in HH:MM format, and include type or notes when the request provides them.',
    '- Set shouldGenerateResponse to false only when the selected tools fully satisfy a short command.',
    '- Set shouldGenerateResponse to true when the user needs spoken confirmation, explanation, or conversation in addition to any tool execution.',
    '- Never invent unsupported tools, screens, or arguments.',
  ].join('\n');
}

export function buildConversationRoutingToolDefinition() {
  return {
    name: 'plan_conversation_turn',
    description:
      'Select the next assistant tool calls and whether a spoken response is still needed.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        toolCalls: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: {
                type: 'string',
                enum: [
                  'navigate',
                  'play_radio',
                  'read_news',
                  'vision_scan',
                  'set_listen_mode',
                  'stop_audio',
                  'start_google_auth',
                  'open_tester_feedback',
                  'check_tester_updates',
                  'get_subscription_status',
                  'get_allowed_languages',
                  'get_onboarding_status',
                  'get_health_reminders',
                  'check_symptoms',
                  'create_health_reminder',
                ],
              },
              args: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  screen: {
                    type: 'string',
                    enum: [...SUPPORTED_CONVERSATION_SCREENS],
                  },
                  genre: { type: 'string' },
                  category: { type: 'string' },
                  openScreen: { type: 'boolean' },
                  enabled: { type: 'boolean' },
                  symptoms: { type: 'string' },
                  title: { type: 'string' },
                  time: { type: 'string' },
                  type: {
                    type: 'string',
                    enum: ['medication', 'appointment', 'other'],
                  },
                  notes: { type: 'string' },
                },
              },
            },
            required: ['name', 'args'],
          },
        },
        shouldGenerateResponse: { type: 'boolean' },
      },
      required: ['toolCalls', 'shouldGenerateResponse'],
    },
  } as const;
}

export function parseConversationRoutingArguments(
  value: unknown,
): ParsedToolRoutingResponse | null {
  const payload = parseToolPayload(value);
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const parsed = payload as {
    toolCalls?: unknown[];
    shouldGenerateResponse?: unknown;
  };

  const toolCalls = Array.isArray(parsed.toolCalls)
    ? parsed.toolCalls
        .map((toolCall) => sanitizeConversationToolCall(toolCall))
        .filter((toolCall): toolCall is ConversationToolCall => Boolean(toolCall))
    : [];

  const shouldGenerateResponse =
    typeof parsed.shouldGenerateResponse === 'boolean'
      ? parsed.shouldGenerateResponse
      : toolCalls.length === 0;

  return {
    toolCalls,
    shouldGenerateResponse,
  };
}

function parseToolPayload(value: unknown) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
}

function sanitizeConversationToolCall(value: unknown): ConversationToolCall | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const toolCall = value as { name?: unknown; args?: Record<string, unknown> };
  const args =
    toolCall.args && typeof toolCall.args === 'object' ? toolCall.args : {};

  switch (toolCall.name) {
    case 'navigate':
      return typeof args.screen === 'string' &&
        SUPPORTED_CONVERSATION_SCREENS.includes(
          args.screen as (typeof SUPPORTED_CONVERSATION_SCREENS)[number],
        )
        ? { name: 'navigate', args: { screen: args.screen } }
        : null;
    case 'play_radio':
      return {
        name: 'play_radio',
        args: {
          genre: typeof args.genre === 'string' ? args.genre : undefined,
          openScreen:
            typeof args.openScreen === 'boolean' ? args.openScreen : undefined,
        },
      };
    case 'read_news':
      return {
        name: 'read_news',
        args: {
          category:
            typeof args.category === 'string' ? args.category : undefined,
          openScreen:
            typeof args.openScreen === 'boolean' ? args.openScreen : undefined,
        },
      };
    case 'vision_scan':
      return { name: 'vision_scan', args: {} };
    case 'set_listen_mode':
      return typeof args.enabled === 'boolean'
        ? { name: 'set_listen_mode', args: { enabled: args.enabled } }
        : null;
    case 'stop_audio':
      return { name: 'stop_audio', args: {} };
    case 'start_google_auth':
      return { name: 'start_google_auth', args: {} };
    case 'open_tester_feedback':
      return { name: 'open_tester_feedback', args: {} };
    case 'check_tester_updates':
      return { name: 'check_tester_updates', args: {} };
    case 'get_subscription_status':
      return { name: 'get_subscription_status', args: {} };
    case 'get_allowed_languages':
      return { name: 'get_allowed_languages', args: {} };
    case 'get_onboarding_status':
      return { name: 'get_onboarding_status', args: {} };
    case 'get_health_reminders':
      return { name: 'get_health_reminders', args: {} };
    case 'check_symptoms':
      return typeof args.symptoms === 'string' && args.symptoms.trim().length > 0
        ? { name: 'check_symptoms', args: { symptoms: args.symptoms.trim() } }
        : null;
    case 'create_health_reminder':
      return typeof args.title === 'string' &&
        args.title.trim().length > 0 &&
        typeof args.time === 'string' &&
        /^\d{2}:\d{2}$/.test(args.time.trim())
        ? {
            name: 'create_health_reminder',
            args: {
              title: args.title.trim(),
              time: args.time.trim(),
              type:
                args.type === 'medication' ||
                args.type === 'appointment' ||
                args.type === 'other'
                  ? args.type
                  : undefined,
              notes:
                typeof args.notes === 'string' && args.notes.trim().length > 0
                  ? args.notes.trim()
                  : undefined,
            },
          }
        : null;
    default:
      return null;
  }
}
