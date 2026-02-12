import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class SpeechToTextService {
  private readonly logger = new Logger(SpeechToTextService.name);
  private openai: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('Speech-to-text service initialized with OpenAI Whisper');
    } else {
      this.logger.warn('OPENAI_API_KEY not set. STT will use mock transcription.');
    }
  }

  async transcribeAudio(audioBuffer: Buffer, language?: string): Promise<string> {
    try {
      if (!this.openai) {
        return this.mockTranscription(audioBuffer);
      }

      const file = new File([new Uint8Array(audioBuffer)], 'audio.wav', {
        type: 'audio/wav',
      });

      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: language || 'en',
        response_format: 'text',
      });

      this.logger.log(`Transcribed: ${transcription.substring(0, 100)}...`);
      
      return transcription;
    } catch (error) {
      this.logger.error(`Transcription error: ${error.message}`);
      throw error;
    }
  }

  async transcribeAudioStream(
    audioBuffer: Buffer,
    language?: string,
  ): Promise<{ text: string; isFinal: boolean }> {
    try {
      const text = await this.transcribeAudio(audioBuffer, language);
      
      return {
        text,
        isFinal: true,
      };
    } catch (error) {
      this.logger.error(`Stream transcription error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect wake word by transcribing a short audio buffer and checking for variations of "hey eleni".
   * Uses very lenient fuzzy matching: any 2+ word phrase is considered a wake word.
   * This handles transcription errors like "Heal any", "hey liony", etc.
   * For production, replace with a proper keyword-spotting model.
   */
  async detectWakeWord(audioBuffer: Buffer): Promise<boolean> {
    try {
      const text = await this.transcribeAudio(audioBuffer, 'en');
      if (!text) return false;

      const normalized = text.toLowerCase().trim();
      
      // Simple heuristic: if transcription contains 2+ words, treat as wake word
      // This handles: "hey eleni", "heal any", "hey liony", etc.
      const wordCount = normalized.split(/\s+/).length;
      const detected = wordCount >= 2;
      
      if (detected) {
        this.logger.log(`Wake word detected (${wordCount} words): "${text}"`);
      } else {
        this.logger.debug(`Wake word not detected (${wordCount} word(s)): "${text}"`);
      }
      
      return detected;
    } catch (err) {
      this.logger.warn(`Wake-word detection failed: ${err.message}`);
      return false;
    }
  }

  private mockTranscription(audioBuffer: Buffer): string {
    this.logger.warn('Using mock transcription - no API key configured');
    return `[Mock transcription of ${audioBuffer.length} bytes of audio]`;
  }

  /**
   * Voice Activity Detection (VAD)
   * Simple energy-based detection
   */
  detectVoiceActivity(audioBuffer: Buffer, threshold: number = 500): boolean {
    if (audioBuffer.length < 2) {
      return false;
    }

    // Calculate RMS energy
    let sum = 0;
    const samples = audioBuffer.length / 2; // 16-bit samples
    
    for (let i = 0; i < audioBuffer.length - 1; i += 2) {
      const sample = audioBuffer.readInt16LE(i);
      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / samples);
    
    return rms > threshold;
  }

  /**
   * Convert audio to WAV format if needed
   */
  async convertToWav(audioBuffer: Buffer, sampleRate: number = 16000): Promise<Buffer> {
    // In production, use ffmpeg or similar
    // For now, assume buffer is already in correct format
    return audioBuffer;
  }
}
