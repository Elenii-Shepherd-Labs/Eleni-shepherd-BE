import {
  ConversationAgentState,
  ConversationClientState,
} from './interfaces/conversation-agent.interface';

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
