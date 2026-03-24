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

function unreachableToolOrAction(value: never): never {
  throw new Error(`Unhandled tool or action variant: ${JSON.stringify(value)}`);
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
    default:
      return null;
  }
}

function executeToolCall(
  toolCall: ConversationToolCall,
  clientState?: ConversationClientState,
): ConversationClientAction[] {
  switch (toolCall.name) {
    case 'navigate':
      return [{ type: 'navigate', screen: toolCall.args.screen }];
    case 'play_radio': {
      const actions: ConversationClientAction[] = [];
      if (
        toolCall.args.openScreen &&
        clientState?.currentRoute?.trim() !== 'Radio'
      ) {
        actions.push({ type: 'navigate', screen: 'Radio' });
      }
      actions.push({ type: 'play_radio', genre: toolCall.args.genre });
      return actions;
    }
    case 'read_news': {
      const actions: ConversationClientAction[] = [];
      if (
        toolCall.args.openScreen &&
        clientState?.currentRoute?.trim() !== 'News'
      ) {
        actions.push({ type: 'navigate', screen: 'News' });
      }
      actions.push({ type: 'read_news', category: toolCall.args.category });
      return actions;
    }
    case 'vision_scan':
      return [{ type: 'vision_scan' }];
    case 'set_listen_mode':
      return [{ type: 'set_listen_mode', enabled: toolCall.args.enabled }];
    case 'stop_audio':
      return [{ type: 'stop_audio' }];
    case 'start_google_auth':
      return [{ type: 'start_google_auth' }];
    default:
      return [];
  }
}

export function executeConversationToolCalls(
  toolCalls: ConversationToolCall[],
  clientState?: ConversationClientState,
): ExecutedToolCalls {
  const actions = toolCalls.flatMap((toolCall) =>
    executeToolCall(toolCall, clientState),
  );

  return {
    actions,
    actionAcknowledgement: buildActionAcknowledgement(toolCalls[0]),
    toolExecutionContext: buildToolExecutionContext(toolCalls, actions, clientState),
  };
}

function buildToolExecutionContext(
  toolCalls: ConversationToolCall[],
  actions: ConversationClientAction[],
  clientState?: ConversationClientState,
) {
  if (toolCalls.length === 0) {
    return null;
  }

  const plannedTools = toolCalls
    .map((toolCall) => {
      switch (toolCall.name) {
        case 'navigate':
          return `navigate to ${toolCall.args.screen}`;
        case 'play_radio':
          return `play radio${toolCall.args.genre ? ` for ${toolCall.args.genre}` : ''}`;
        case 'read_news':
          return `read news${toolCall.args.category ? ` for ${toolCall.args.category}` : ''}`;
        case 'vision_scan':
          return 'perform a vision scan';
        case 'set_listen_mode':
          return toolCall.args.enabled
            ? 'enable always-listen mode'
            : 'disable always-listen mode';
        case 'stop_audio':
          return 'stop audio playback';
        case 'start_google_auth':
          return 'start Google sign in';
      }

      return unreachableToolOrAction(toolCall);
    })
    .join(', ');

  const emittedActions = actions
    .map((action) => {
      switch (action.type) {
        case 'navigate':
          return `navigate:${action.screen}`;
        case 'play_radio':
          return `play_radio:${action.genre || 'Nigeria'}`;
        case 'read_news':
          return `read_news:${action.category || 'news'}`;
        case 'vision_scan':
          return 'vision_scan';
        case 'set_listen_mode':
          return action.enabled
            ? 'set_listen_mode:on'
            : 'set_listen_mode:off';
        case 'stop_audio':
          return 'stop_audio';
        case 'start_google_auth':
          return 'start_google_auth';
      }

      return unreachableToolOrAction(action);
    })
    .join(', ');

  const routeContext = clientState?.currentRoute
    ? ` Current route before execution: ${clientState.currentRoute}.`
    : '';

  return `Planned tools: ${plannedTools}. Emitted actions: ${
    emittedActions || 'none'
  }.${routeContext}`;
}
