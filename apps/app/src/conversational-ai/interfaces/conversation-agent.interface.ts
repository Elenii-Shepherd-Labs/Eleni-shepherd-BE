export type ConversationClientAction =
  | { type: 'navigate'; screen: string }
  | { type: 'play_radio'; genre?: string }
  | { type: 'read_news'; category?: string }
  | { type: 'vision_scan' }
  | { type: 'set_listen_mode'; enabled: boolean }
  | { type: 'stop_audio' }
  | { type: 'start_google_auth' }
  | { type: 'open_tester_feedback' }
  | { type: 'check_tester_updates' };

export type ConversationToolCall =
  | { name: 'navigate'; args: { screen: string } }
  | { name: 'play_radio'; args: { genre?: string; openScreen?: boolean } }
  | { name: 'read_news'; args: { category?: string; openScreen?: boolean } }
  | { name: 'vision_scan'; args: Record<string, never> }
  | { name: 'set_listen_mode'; args: { enabled: boolean } }
  | { name: 'stop_audio'; args: Record<string, never> }
  | { name: 'start_google_auth'; args: Record<string, never> }
  | { name: 'open_tester_feedback'; args: Record<string, never> }
  | { name: 'check_tester_updates'; args: Record<string, never> }
  | { name: 'get_subscription_status'; args: Record<string, never> }
  | { name: 'get_allowed_languages'; args: Record<string, never> }
  | { name: 'get_onboarding_status'; args: Record<string, never> }
  | { name: 'get_health_reminders'; args: Record<string, never> }
  | { name: 'check_symptoms'; args: { symptoms: string } }
  | {
      name: 'create_health_reminder';
      args: {
        title: string;
        time: string;
        type?: 'medication' | 'appointment' | 'other';
        notes?: string;
      };
    };

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

export type ConversationToolRoutingDecision = {
  toolCalls: ConversationToolCall[];
  shouldGenerateResponse: boolean;
  source: 'model' | 'fallback';
};

export interface ConversationAgentResult {
  response: string;
  actions: ConversationClientAction[];
  agent: ConversationAgentState;
}
