import { Injectable } from '@nestjs/common';
import { LANGUAGE_NAMES } from '../subscription/subscription.constants';
import { SubscriptionService } from '../subscription/subscription.service';
import { TelehealthService } from '../telehealth/telehealth.service';
import {
  ConversationClientAction,
  ConversationClientState,
  ConversationToolCall,
} from './interfaces/conversation-agent.interface';

type ExecutedToolCalls = {
  actions: ConversationClientAction[];
  actionAcknowledgement: string | null;
  toolExecutionContext: string | null;
};

@Injectable()
export class ConversationAgentToolExecutorService {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly telehealthService: TelehealthService,
  ) {}

  async executeToolCalls(
    toolCalls: ConversationToolCall[],
    options: {
      clientState?: ConversationClientState;
      userId?: string | null;
    } = {},
  ): Promise<ExecutedToolCalls> {
    const actions: ConversationClientAction[] = [];
    const contextSummaries: string[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeToolCall(toolCall, options);
      actions.push(...result.actions);
      if (result.summary) {
        contextSummaries.push(result.summary);
      }
    }

    const routeContext = options.clientState?.currentRoute
      ? ` Current route before execution: ${options.clientState.currentRoute}.`
      : '';

    return {
      actions,
      actionAcknowledgement: buildActionAcknowledgement(toolCalls[0]),
      toolExecutionContext: toolCalls.length
        ? `Tool outcomes: ${contextSummaries.join(' ')}.${routeContext}`.trim()
        : null,
    };
  }

  private async executeToolCall(
    toolCall: ConversationToolCall,
    options: {
      clientState?: ConversationClientState;
      userId?: string | null;
    },
  ) {
    switch (toolCall.name) {
      case 'navigate':
        return {
          actions: [{ type: 'navigate', screen: toolCall.args.screen }] as ConversationClientAction[],
          summary: `navigate to ${toolCall.args.screen}`,
        };
      case 'play_radio': {
        const actions: ConversationClientAction[] = [];
        if (
          toolCall.args.openScreen &&
          options.clientState?.currentRoute?.trim() !== 'Radio'
        ) {
          actions.push({ type: 'navigate', screen: 'Radio' });
        }
        actions.push({ type: 'play_radio', genre: toolCall.args.genre });
        return {
          actions,
          summary: `play radio${toolCall.args.genre ? ` for ${toolCall.args.genre}` : ''}`,
        };
      }
      case 'read_news': {
        const actions: ConversationClientAction[] = [];
        if (
          toolCall.args.openScreen &&
          options.clientState?.currentRoute?.trim() !== 'News'
        ) {
          actions.push({ type: 'navigate', screen: 'News' });
        }
        actions.push({ type: 'read_news', category: toolCall.args.category });
        return {
          actions,
          summary: `read news${toolCall.args.category ? ` for ${toolCall.args.category}` : ''}`,
        };
      }
      case 'vision_scan':
        return {
          actions: [{ type: 'vision_scan' }] as ConversationClientAction[],
          summary: 'perform a vision scan',
        };
      case 'set_listen_mode':
        return {
          actions: [
            { type: 'set_listen_mode', enabled: toolCall.args.enabled },
          ] as ConversationClientAction[],
          summary: toolCall.args.enabled
            ? 'enable always-listen mode'
            : 'disable always-listen mode',
        };
      case 'stop_audio':
        return {
          actions: [{ type: 'stop_audio' }] as ConversationClientAction[],
          summary: 'stop audio playback',
        };
      case 'start_google_auth':
        return {
          actions: [{ type: 'start_google_auth' }] as ConversationClientAction[],
          summary: 'start Google sign in',
        };
      case 'open_tester_feedback':
        return {
          actions: [{ type: 'open_tester_feedback' }] as ConversationClientAction[],
          summary: 'open tester feedback',
        };
      case 'check_tester_updates':
        return {
          actions: [{ type: 'check_tester_updates' }] as ConversationClientAction[],
          summary: 'check for tester build updates',
        };
      case 'get_subscription_status': {
        const tier = await this.subscriptionService.getUserTier(
          options.userId || undefined,
        );
        const languages = this.subscriptionService.getAllowedLanguages(
          options.userId || undefined,
          tier,
        );
        const languageNames = languages.map(
          (languageCode) => LANGUAGE_NAMES[languageCode] || languageCode,
        );

        return {
          actions: [],
          summary: `subscription tier is ${tier} with access to ${languageNames.join(', ')}`,
        };
      }
      case 'get_allowed_languages': {
        const tier = await this.subscriptionService.getUserTier(
          options.userId || undefined,
        );
        const languages = this.subscriptionService.getAllowedLanguages(
          options.userId || undefined,
          tier,
        );
        const languageNames = languages.map(
          (languageCode) => LANGUAGE_NAMES[languageCode] || languageCode,
        );

        return {
          actions: [],
          summary: `allowed languages are ${languageNames.join(', ')} on the ${tier} tier`,
        };
      }
      case 'get_health_reminders': {
        if (!options.userId) {
          return {
            actions: [],
            summary:
              'no authenticated user is available for reminder lookup yet',
          };
        }

        const reminderResponse = await this.telehealthService.getRemindersByUser(
          options.userId,
        );
        const reminders = Array.isArray(reminderResponse.data)
          ? reminderResponse.data
          : [];

        if (!reminders.length) {
          return {
            actions: [],
            summary: 'no active health reminders were found',
          };
        }

        const formattedReminders = reminders
          .slice(0, 3)
          .map((reminder: any) => `${reminder.title} at ${reminder.time}`)
          .join(', ');

        return {
          actions: [],
          summary: `health reminders include ${formattedReminders}`,
        };
      }
      case 'check_symptoms': {
        const symptomResponse = await this.telehealthService.checkSymptoms({
          symptoms: toolCall.args.symptoms,
          userId: options.userId || undefined,
        });
        const guidance =
          symptomResponse.data?.guidance ||
          'symptom guidance is unavailable right now';

        return {
          actions: [],
          summary: `symptom guidance: ${guidance}`,
        };
      }
      default:
        return unreachableTool(toolCall);
    }
  }
}

function buildActionAcknowledgement(
  toolCall: ConversationToolCall | undefined,
): string | null {
  if (!toolCall) {
    return null;
  }

  switch (toolCall.name) {
    case 'stop_audio':
      return 'Stopping audio now.';
    case 'set_listen_mode':
      return `Switched to ${
        toolCall.args.enabled ? 'always listen' : 'tap to listen'
      } mode.`;
    case 'navigate':
      if (toolCall.args.screen === 'Navigation') {
        return 'Opening navigation now.';
      }
      return `Opening ${toolCall.args.screen.toLowerCase()} now.`;
    case 'play_radio':
      return `Opening radio and tuning into ${
        toolCall.args.genre || 'Nigeria'
      } stations.`;
    case 'read_news':
      return 'Opening news and reading the latest headlines.';
    case 'vision_scan':
      return 'Starting a quick scan now.';
    case 'start_google_auth':
      return 'Okay. Opening Google sign in now.';
    case 'open_tester_feedback':
      return 'Opening tester feedback now.';
    case 'check_tester_updates':
      return 'Checking for a newer tester build now.';
    case 'get_subscription_status':
      return 'Checking your subscription details now.';
    case 'get_allowed_languages':
      return 'Checking your available languages now.';
    case 'get_health_reminders':
      return 'Checking your health reminders now.';
    case 'check_symptoms':
      return 'Checking your symptoms now.';
    default:
      return unreachableTool(toolCall);
  }
}

function unreachableTool(value: never): never {
  throw new Error(`Unhandled conversation tool: ${JSON.stringify(value)}`);
}
