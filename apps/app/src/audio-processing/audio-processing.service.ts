import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpeechToTextService } from '../speech-to-text/speech-to-text.service';
import { TextToSpeechService } from '../text-to-speech/text-to-speech.service';
import { AudioBuffer } from './interfaces/audio-buffer.interface';

@Injectable()
export class AudioProcessingService {
  private readonly logger = new Logger(AudioProcessingService.name);
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  // sessionId -> settings
  private sessionSettings: Map<
    string,
    { alwaysListen: boolean; awake: boolean; tapToListenExpiresAt?: number }
  > = new Map();
  private readonly SILENCE_THRESHOLD_MS: number;
  private readonly MIN_AUDIO_LENGTH_BYTES: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly sttService: SpeechToTextService,
    private readonly ttsService: TextToSpeechService,
  ) {
    this.SILENCE_THRESHOLD_MS = this.configService.get<number>('AI_SILENCE_THRESHOLD_MS') || 1500;
    this.MIN_AUDIO_LENGTH_BYTES = this.configService.get<number>('AI_MIN_AUDIO_LENGTH_BYTES') || 8000;
  }

  async processAudioChunk(
    sessionId: string,
    audioChunk: Buffer,
    sampleRate: number,
  ): Promise<{ transcript?: string; isFinal: boolean }> {
    try {
      let buffer = this.audioBuffers.get(sessionId);

      if (!buffer) {
        buffer = {
          sessionId,
          chunks: [],
          totalBytes: 0,
          lastChunkTime: new Date(),
        };
        this.audioBuffers.set(sessionId, buffer);
      }

      const hasVoice = this.sttService.detectVoiceActivity(audioChunk);

      const settings = this.sessionSettings.get(sessionId) || { alwaysListen: false, awake: false };

      if (hasVoice) {
        buffer.chunks.push(audioChunk);
        buffer.totalBytes += audioChunk.length;
        buffer.lastChunkTime = new Date();

        this.logger.debug(
          `Added audio chunk: ${audioChunk.length} bytes. Total: ${buffer.totalBytes}`,
        );

        const now = Date.now();
        const tapActive = (settings.tapToListenExpiresAt || 0) > now;

        // Quick wake-word check for always-listen mode
        if (settings.alwaysListen && !settings.awake && buffer.totalBytes >= this.MIN_AUDIO_LENGTH_BYTES / 4) {
          try {
            const candidate = Buffer.concat(buffer.chunks.map((c) => Buffer.from(c)) as unknown as Uint8Array[]);
            const wakeDetected = await this.sttService.detectWakeWord(candidate);

            if (wakeDetected) {
              settings.awake = true;
              this.sessionSettings.set(sessionId, settings);
              this.logger.log(`Wake word detected for session ${sessionId}`);
              
              // Transcribe and return immediately with the wake word
              const transcript = await this.sttService.transcribeAudio(candidate);
              
              // Clear buffer for next utterance
              this.audioBuffers.delete(sessionId);
              
              return {
                transcript,
                isFinal: true,
              };
            }
          } catch (err) {
            this.logger.warn(`Wake-word check failed: ${err.message}`);
          }
        }

        if (tapActive) return { isFinal: false };

        return { isFinal: false };
      } else {
        const silenceDuration = Date.now() - buffer.lastChunkTime.getTime();

        if (
          buffer.chunks.length > 0 &&
          buffer.totalBytes >= this.MIN_AUDIO_LENGTH_BYTES &&
          silenceDuration >= this.SILENCE_THRESHOLD_MS
        ) {
          const completeAudio = Buffer.concat(buffer.chunks.map((c) => Buffer.from(c)) as unknown as Uint8Array[]);
          this.audioBuffers.delete(sessionId);

          const currentSettings = this.sessionSettings.get(sessionId) || { alwaysListen: false, awake: false };
          const now = Date.now();
          const tapActive = (currentSettings.tapToListenExpiresAt || 0) > now;

          if (currentSettings.alwaysListen && !currentSettings.awake && !tapActive) {
            this.logger.debug(`Ignoring non-wake audio for session ${sessionId} (always-listen waiting)`);
            return { isFinal: false };
          }

          const transcript = await this.sttService.transcribeAudio(completeAudio);

          if (currentSettings.awake) {
            currentSettings.awake = false;
            this.sessionSettings.set(sessionId, currentSettings);
          }

          return {
            transcript,
            isFinal: true,
          };
        }

        return { isFinal: false };
      }
    } catch (error) {
      this.logger.error(`Error processing audio chunk: ${error.message}`);
      throw error;
    }
  }

  async setAlwaysListening(sessionId: string, enabled: boolean) {
    const settings = this.sessionSettings.get(sessionId) || { alwaysListen: false, awake: false };
    settings.alwaysListen = !!enabled;
    if (!enabled) settings.awake = false;
    this.sessionSettings.set(sessionId, settings);
    this.logger.log(`Session ${sessionId} alwaysListen=${settings.alwaysListen}`);
  }

  async tapToListen(sessionId: string, durationMs: number = 10000) {
    const settings = this.sessionSettings.get(sessionId) || { alwaysListen: false, awake: false };
    settings.tapToListenExpiresAt = Date.now() + durationMs;
    this.sessionSettings.set(sessionId, settings);
    this.logger.log(`Session ${sessionId} tapToListen for ${durationMs}ms`);
  }

  async *textToAudioStream(
    sessionId: string,
    text: string,
  ): AsyncGenerator<Buffer> {
    this.logger.log(`Generating audio for session ${sessionId}: ${text.substring(0, 50)}...`);

    try {
      const textChunks = this.ttsService.splitTextForStreaming(text);

      for (const chunk of textChunks) {
        for await (const audioChunk of this.ttsService.streamSpeech(chunk)) {
          yield audioChunk;
        }
      }
    } catch (error) {
      this.logger.error(`Error generating audio stream: ${error.message}`);
      throw error;
    }
  }

  async stopAudioPlayback(sessionId: string): Promise<void> {
    this.logger.log(`Stopping audio playback for session ${sessionId}`);
    this.audioBuffers.delete(sessionId);
  }

  async cleanup(sessionId: string): Promise<void> {
    this.logger.log(`Cleaning up audio processing for session ${sessionId}`);
    this.audioBuffers.delete(sessionId);
  }

  async processCompleteAudio(
    audioBuffer: Buffer,
    sampleRate: number = 16000,
  ): Promise<string> {
    try {
      const transcript = await this.sttService.transcribeAudio(audioBuffer);
      return transcript;
    } catch (error) {
      this.logger.error(`Error processing complete audio: ${error.message}`);
      throw error;
    }
  }

  async generateCompleteAudio(text: string): Promise<Buffer> {
    try {
      const audio = await this.ttsService.generateSpeech(text);
      return audio;
    } catch (error) {
      this.logger.error(`Error generating complete audio: ${error.message}`);
      throw error;
    }
  }
}
