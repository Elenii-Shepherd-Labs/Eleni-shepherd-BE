import { Controller, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { SpeechToTextService } from './speech-to-text.service';
import { TranscribeAudioDto, TranscriptionResponseDto } from './dto/index';

@ApiTags('Speech-to-Text')
@Controller('speech-to-text')
export class SpeechToTextController {
  constructor(private readonly speechToTextService: SpeechToTextService) {}

  @Post('transcribe')
  @ApiOperation({
    summary: 'Transcribe audio to text',
    description:
      'Convert speech in audio files to text using OpenAI Whisper API. Supports WAV, MP3, and other formats.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audioFile: {
          type: 'string',
          format: 'binary',
          description: 'Audio file to transcribe',
        },
        language: {
          type: 'string',
          description: 'Language code (en, es, fr, etc.)',
          example: 'en',
        },
      },
      required: ['audioFile'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Audio transcribed successfully',
    type: TranscriptionResponseDto,
  })
  @UseInterceptors(FileInterceptor('audioFile'))
  async transcribeAudio(
    @UploadedFile() file: any,
    @Body() body: { language?: string },
  ) {
    if (!file) {
      throw new Error('No audio file provided');
    }

    const text = await this.speechToTextService.transcribeAudio(
      file.buffer,
      body.language,
    );

    return {
      text,
      isFinal: true,
      provider: 'openai',
    };
  }

  @Post('voice-activity-detection')
  @ApiOperation({
    summary: 'Detect voice activity in audio',
    description:
      'Simple energy-based voice activity detection. Returns true if voice is detected.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audioFile: {
          type: 'string',
          format: 'binary',
          description: 'Audio file to analyze',
        },
        threshold: {
          type: 'number',
          description: 'Energy threshold for voice detection',
          example: 500,
        },
      },
      required: ['audioFile'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Voice activity detection result',
    schema: {
      properties: {
        voiceDetected: {
          type: 'boolean',
          description: 'Whether voice activity was detected',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('audioFile'))
  async detectVoiceActivity(
    @UploadedFile() file: any,
    @Body() body: { threshold?: number },
  ) {
    if (!file) {
      throw new Error('No audio file provided');
    }

    const voiceDetected = this.speechToTextService.detectVoiceActivity(
      file.buffer,
      body.threshold || 500,
    );

    return {
      voiceDetected,
      audioLength: file.buffer.length,
    };
  }
}
