import {
  ConversationAgentState,
  ConversationClientState,
  ConversationToolCall,
} from './interfaces/conversation-agent.interface';

type IntentPlanner = {
  matches: (
    normalized: string,
    clientState?: ConversationClientState,
  ) => boolean;
  buildToolCalls: (
    normalized: string,
    clientState?: ConversationClientState,
  ) => ConversationToolCall[];
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

function buildNewsToolCalls(
  normalized: string,
  _clientState?: ConversationClientState,
) {
  if (hasAny(normalized, 'open', 'go', 'navigate')) {
    return [{ name: 'navigate', args: { screen: 'News' } } satisfies ConversationToolCall];
  }

  return [
    {
      name: 'read_news',
      args: { category: 'news', openScreen: true },
    } satisfies ConversationToolCall,
  ];
}

function buildRadioToolCalls(
  normalized: string,
  _clientState?: ConversationClientState,
) {
  if (hasAny(normalized, 'open', 'go', 'navigate')) {
    return [{ name: 'navigate', args: { screen: 'Radio' } } satisfies ConversationToolCall];
  }

  let genre = 'Nigeria';
  if (hasAny(normalized, 'jazz')) genre = 'Jazz';
  else if (hasAny(normalized, 'gospel')) genre = 'Gospel';

  return [
    {
      name: 'play_radio',
      args: { genre, openScreen: true },
    } satisfies ConversationToolCall,
  ];
}

const intentPlanners: IntentPlanner[] = [
  {
    matches: (normalized, clientState) =>
      Boolean(
        clientState?.onboardingPhase === 'pre_auth' &&
          !clientState?.hasVerifiedIdentity &&
          isGoogleAuthIntent(normalized),
      ),
    buildToolCalls: () => [{ name: 'start_google_auth', args: {} }],
  },
  {
    matches: (normalized) => hasAny(normalized, 'stop', 'quiet', 'pause'),
    buildToolCalls: () => [{ name: 'stop_audio', args: {} }],
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
    buildToolCalls: (normalized) => [
      {
        name: 'set_listen_mode',
        args: { enabled: hasAny(normalized, 'always') },
      },
    ],
  },
  {
    matches: (normalized) => hasAny(normalized, 'settings'),
    buildToolCalls: () => [{ name: 'navigate', args: { screen: 'Settings' } }],
  },
  {
    matches: (normalized) => hasAny(normalized, 'home', 'dashboard'),
    buildToolCalls: () => [{ name: 'navigate', args: { screen: 'Home' } }],
  },
  {
    matches: (normalized) => hasAny(normalized, 'news', 'headline', 'headlines'),
    buildToolCalls: buildNewsToolCalls,
  },
  {
    matches: (normalized) => hasAny(normalized, 'radio', 'station', 'music'),
    buildToolCalls: buildRadioToolCalls,
  },
  {
    matches: (normalized) =>
      hasAny(normalized, 'scan', 'what is this', 'look at', 'read this'),
    buildToolCalls: () => [{ name: 'vision_scan', args: {} }],
  },
  {
    matches: (normalized) =>
      hasAny(normalized, 'navigate', 'walk', 'path', 'ahead', 'route'),
    buildToolCalls: () => [
      { name: 'navigate', args: { screen: 'Navigation' } },
    ],
  },
];

export function normalizeUtterance(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deriveToolCalls(
  userMessage: string,
  clientState?: ConversationClientState,
): ConversationToolCall[] {
  const normalized = normalizeUtterance(userMessage);
  if (!normalized) {
    return [];
  }

  const planner = intentPlanners.find((candidate) =>
    candidate.matches(normalized, clientState),
  );

  return planner?.buildToolCalls(normalized, clientState) || [];
}

export function shouldShortCircuitToToolResponse(
  userMessage: string,
  toolCalls: ConversationToolCall[],
) {
  if (toolCalls.length === 0) {
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
