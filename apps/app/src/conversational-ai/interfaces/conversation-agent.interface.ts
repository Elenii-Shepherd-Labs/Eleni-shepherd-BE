export type ConversationClientAction =
  | { type: 'navigate'; screen: string }
  | { type: 'play_radio'; genre?: string }
  | { type: 'read_news'; category?: string }
  | { type: 'vision_scan' }
  | { type: 'set_listen_mode'; enabled: boolean }
  | { type: 'stop_audio' }
  | { type: 'start_google_auth' };

export type ConversationClientState = {
  currentRoute?: string;
  onboardingPhase?: 'pre_auth' | 'awaiting_name' | 'creating_profile' | 'assistant';
  hasVerifiedIdentity?: boolean;
  isAlwaysListen?: boolean;
};

export type ConversationAgentState = {
  mode: 'onboarding' | 'assistant';
  workflow: 'pre_auth' | 'awaiting_name' | 'creating_profile' | 'assistant';
  currentRoute?: string;
  shouldKeepListening: boolean;
};

export interface ConversationAgentResult {
  response: string;
  actions: ConversationClientAction[];
  agent: ConversationAgentState;
}
