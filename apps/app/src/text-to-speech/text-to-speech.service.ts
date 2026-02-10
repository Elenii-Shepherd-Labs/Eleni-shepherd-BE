import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import axios from 'axios';

@Injectable()
export class TextToSpeechService {
  private readonly logger = new Logger(TextToSpeechService.name);
  private openai: OpenAI | null = null;
  private elevenLabsApiKey: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const elevenLabsKey = this.configService.get<string>('ELEVENLABS_API_KEY');

    if (elevenLabsKey) {
      this.elevenLabsApiKey = elevenLabsKey;
      this.logger.log('TTS initialized with ElevenLabs');
    } else if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.logger.log('TTS initialized with OpenAI');
    } else {
      this.logger.warn('No TTS API keys configured. Using mock audio.');
    }
  }

  async generateSpeech(text: string, voice?: string): Promise<Buffer> {
    try {
      if (this.elevenLabsApiKey) {
        return await this.generateElevenLabsSpeech(text, voice);
      } else if (this.openai) {
        return await this.generateOpenAISpeech(text, voice);
      } else {
        return this.generateMockAudio(text);
      }
    } catch (error) {
      this.logger.error(`TTS error: ${error.message}`);
      throw error;
    }
  }

  async *streamSpeech(text: string, voice?: string): AsyncGenerator<Buffer> {
    try {
      if (this.elevenLabsApiKey) {
        yield* this.streamElevenLabsSpeech(text, voice);
      } else if (this.openai) {
        yield* this.streamOpenAISpeech(text, voice);
      } else {
        yield this.generateMockAudio(text);
      }
    } catch (error) {
      this.logger.error(`TTS streaming error: ${error.message}`);
      throw error;
    }
  }

  private async generateOpenAISpeech(text: string, voice?: string): Promise<Buffer> {
    const mp3 = await this.openai!.audio.speech.create({
      model: 'tts-1',
      voice: (voice as any) || 'alloy',
      input: text,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    this.logger.log(`Generated ${buffer.length} bytes of audio`);
    
    return buffer;
  }

  private async *streamOpenAISpeech(
    text: string,
    voice?: string,
  ): AsyncGenerator<Buffer> {
    const audio = await this.generateOpenAISpeech(text, voice);
    
    // Split into chunks for streaming
    const chunkSize = 4096;
    
    for (let i = 0; i < audio.length; i += chunkSize) {
      yield audio.slice(i, i + chunkSize);
    }
  }

  private async generateElevenLabsSpeech(
    text: string,
    voiceId?: string,
  ): Promise<Buffer> {
    const voice = voiceId || this.configService.get<string>('ELEVENLABS_VOICE_ID') || 'EXAVITQu4vr4xnSDxMaL';

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': this.elevenLabsApiKey!,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      },
    );

    const buffer = Buffer.from(response.data);
    this.logger.log(`Generated ${buffer.length} bytes of audio with ElevenLabs`);
    
    return buffer;
  }

  private async *streamElevenLabsSpeech(
    text: string,
    voiceId?: string,
  ): AsyncGenerator<Buffer> {
    const voice = voiceId || this.configService.get<string>('ELEVENLABS_VOICE_ID') || 'EXAVITQu4vr4xnSDxMaL';

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': this.elevenLabsApiKey!,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
        },
      );

      for await (const chunk of response.data) {
        yield Buffer.from(chunk);
      }
    } catch (error) {
      this.logger.error(`ElevenLabs streaming error: ${error.message}`);
      throw error;
    }
  }

  private generateMockAudio(text: string): Buffer {
    this.logger.warn('Generating mock audio - no API keys configured');
    
    const sampleRate = 16000;
    const duration = Math.min(text.length * 0.05, 5);
    const numSamples = Math.floor(sampleRate * duration);
    
    return Buffer.alloc(numSamples * 2);
  }

  /**
   * Split text into chunks for streaming
   */
  splitTextForStreaming(text: string, maxChunkLength: number = 200): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxChunkLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
}
