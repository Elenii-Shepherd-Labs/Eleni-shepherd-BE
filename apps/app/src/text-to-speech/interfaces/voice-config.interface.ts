export interface VoiceConfig {
  voiceId: string;
  provider: 'openai' | 'elevenlabs';
  stability?: number;
  similarityBoost?: number;
  style?: number;
}

export interface SpeechGenerationOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  format?: 'mp3' | 'wav' | 'pcm';
}
