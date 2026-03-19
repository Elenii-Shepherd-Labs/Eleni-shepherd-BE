import {
  ConversationAgentState,
  ConversationClientAction,
  ConversationClientState,
} from './interfaces/conversation-agent.interface';

type IntentPlanner = {
  matches: (
    normalized: string,
    clientState?: ConversationClientState,
  ) => boolean;
  buildActions: (
    normalized: string,
    clientState?: ConversationClientState,
  ) => ConversationClientAction[];
};

function hasAny(normalized: string, ...phrases: string[]) {
  return phrases.some((phrase) => normalized.includes(phrase));
}

function isGoogleAuthIntent(normalized: string) {
  return (
    hasAny(
      normalized,
      'sign in',
      'sign me in',
      'log in',
      'log me in',
      'login',
      'continue',
      'open google sign in',
      'help me sign in',
    ) ||
    normalized.startsWith('sign in ') ||
    normalized.startsWith('sign me in ') ||
    normalized.startsWith('log in ') ||
    normalized.startsWith('log me in ')
  );
}

function buildNewsActions(
  normalized: string,
  clientState?: ConversationClientState,
) {
  if (hasAny(normalized, 'open', 'go', 'navigate')) {
    return [{ type: 'navigate', screen: 'News' } satisfies ConversationClientAction];
  }

  const actions: ConversationClientAction[] = [];
  if (clientState?.currentRoute?.trim() !== 'News') {
    actions.push({ type: 'navigate', screen: 'News' });
  }
  actions.push({ type: 'read_news', category: 'news' });
  return actions;
}

function buildRadioActions(
  normalized: string,
  clientState?: ConversationClientState,
) {
  if (hasAny(normalized, 'open', 'go', 'navigate')) {
    return [{ type: 'navigate', screen: 'Radio' } satisfies ConversationClientAction];
  }

  const actions: ConversationClientAction[] = [];
  if (clientState?.currentRoute?.trim() !== 'Radio') {
    actions.push({ type: 'navigate', screen: 'Radio' });
  }

  let genre = 'Nigeria';
  if (hasAny(normalized, 'jazz')) genre = 'Jazz';
  else if (hasAny(normalized, 'gospel')) genre = 'Gospel';

  actions.push({ type: 'play_radio', genre });
  return actions;
}

const intentPlanners: IntentPlanner[] = [
  {
    matches: (normalized, clientState) =>
      Boolean(
        clientState?.onboardingPhase === 'pre_auth' &&
          !clientState?.hasVerifiedIdentity &&
          isGoogleAuthIntent(normalized),
      ),
    buildActions: () => [{ type: 'start_google_auth' }],
  },
  {
    matches: (normalized) => hasAny(normalized, 'stop', 'quiet', 'pause'),
    buildActions: () => [{ type: 'stop_audio' }],
  },
  {
    matches: (normalized) =>
      hasAny(
        normalized,
        'switch mode',
        'listen mode',
        'always listen',
        'tap to listen',
      ),
    buildActions: (normalized) => [
      {
        type: 'set_listen_mode',
        enabled: hasAny(normalized, 'always'),
      },
    ],
  },
  {
    matches: (normalized) => hasAny(normalized, 'settings'),
    buildActions: () => [{ type: 'navigate', screen: 'Settings' }],
  },
  {
    matches: (normalized) => hasAny(normalized, 'home', 'dashboard'),
    buildActions: () => [{ type: 'navigate', screen: 'Home' }],
  },
  {
    matches: (normalized) => hasAny(normalized, 'news', 'headline', 'headlines'),
    buildActions: buildNewsActions,
  },
  {
    matches: (normalized) => hasAny(normalized, 'radio', 'station', 'music'),
    buildActions: buildRadioActions,
  },
  {
    matches: (normalized) =>
      hasAny(normalized, 'scan', 'what is this', 'look at', 'read this'),
    buildActions: () => [{ type: 'vision_scan' }],
  },
  {
    matches: (normalized) =>
      hasAny(normalized, 'navigate', 'walk', 'path', 'ahead', 'route'),
    buildActions: () => [{ type: 'navigate', screen: 'Navigation' }],
  },
];

export function normalizeUtterance(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deriveClientActions(
  userMessage: string,
  clientState?: ConversationClientState,
): ConversationClientAction[] {
  const normalized = normalizeUtterance(userMessage);
  if (!normalized) {
    return [];
  }

  const planner = intentPlanners.find((candidate) =>
    candidate.matches(normalized, clientState),
  );

  return planner?.buildActions(normalized, clientState) || [];
}

export function buildActionAcknowledgement(
  actions: ConversationClientAction[],
): string | null {
  const primary = actions[0];
  if (!primary) {
    return null;
  }

  switch (primary.type) {
    case 'stop_audio':
      return 'Stopping audio now.';
    case 'set_listen_mode':
      return `Switched to ${
        primary.enabled ? 'always listen' : 'tap to listen'
      } mode.`;
    case 'navigate':
      if (primary.screen === 'Navigation') {
        return 'Opening navigation now.';
      }
      return `Opening ${primary.screen.toLowerCase()} now.`;
    case 'play_radio':
      return `Opening radio and tuning into ${
        primary.genre || 'Nigeria'
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

export function shouldShortCircuitToActionResponse(
  userMessage: string,
  actions: ConversationClientAction[],
) {
  if (actions.length === 0) {
    return false;
  }

  const normalized = normalizeUtterance(userMessage);
  const words = normalized.split(' ').filter(Boolean);
  return (
    words.length <= 8 ||
    normalized.startsWith('open ') ||
    normalized.startsWith('go ') ||
    normalized.startsWith('play ') ||
    normalized.startsWith('read ') ||
    normalized.startsWith('scan ') ||
    normalized.startsWith('navigate ') ||
    normalized.startsWith('stop ') ||
    normalized.startsWith('switch ') ||
    normalized.startsWith('sign ') ||
    normalized.startsWith('log ')
  );
}

export function buildEffectiveContext(
  sessionContext: string,
  clientState?: ConversationClientState,
  extraContext?: string,
) {
  const contextParts = [sessionContext];

  if (clientState?.currentRoute) {
    contextParts.push(`Current mobile route: ${clientState.currentRoute}.`);
  }

  if (clientState?.onboardingPhase) {
    contextParts.push(
      `Current onboarding phase: ${clientState.onboardingPhase}.`,
    );
  }

  if (typeof clientState?.hasVerifiedIdentity === 'boolean') {
    contextParts.push(
      `Verified identity present: ${
        clientState.hasVerifiedIdentity ? 'yes' : 'no'
      }.`,
    );
  }

  if (typeof clientState?.isAlwaysListen === 'boolean') {
    contextParts.push(
      `Listen mode: ${
        clientState.isAlwaysListen ? 'always listen' : 'tap to listen'
      }.`,
    );
  }

  if (extraContext) {
    contextParts.push(extraContext);
  }

  return contextParts.filter(Boolean).join('\n');
}

export function buildAgentState(
  clientState?: ConversationClientState,
): ConversationAgentState {
  const workflow = clientState?.onboardingPhase || 'assistant';
  return {
    mode: workflow === 'assistant' ? 'assistant' : 'onboarding',
    workflow,
    currentRoute: clientState?.currentRoute,
    shouldKeepListening:
      workflow === 'pre_auth' ||
      workflow === 'awaiting_name' ||
      Boolean(clientState?.isAlwaysListen),
  };
}
