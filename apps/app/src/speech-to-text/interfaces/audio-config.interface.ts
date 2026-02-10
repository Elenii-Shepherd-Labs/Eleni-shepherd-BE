export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  format: 'wav' | 'mp3' | 'pcm';
}

export interface VoiceActivityConfig {
  threshold: number;
  silenceDuration: number;
  minAudioLength: number;
}

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
  language?: string;
}
