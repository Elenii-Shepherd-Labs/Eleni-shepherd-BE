export type ConversationClientAction =
  | { type: 'navigate'; screen: string }
  | { type: 'play_radio'; genre?: string }
  | { type: 'read_news'; category?: string }
  | { type: 'vision_scan' }
  | { type: 'set_listen_mode'; enabled: boolean }
  | { type: 'stop_audio' }
  | { type: 'start_google_auth' };

export type ConversationToolCall =
  | { name: 'navigate'; args: { screen: string } }
  | { name: 'play_radio'; args: { genre?: string; openScreen?: boolean } }
  | { name: 'read_news'; args: { category?: string; openScreen?: boolean } }
  | { name: 'vision_scan'; args: Record<string, never> }
  | { name: 'set_listen_mode'; args: { enabled: boolean } }
  | { name: 'stop_audio'; args: Record<string, never> }
  | { name: 'start_google_auth'; args: Record<string, never> };

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
