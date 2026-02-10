import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { TextToSpeechService } from './text-to-speech.service';
import { GenerateSpeechDto, SpeechResponseDto } from './dto/index';

@ApiTags('Text-to-Speech')
@Controller('text-to-speech')
export class TextToSpeechController {
  constructor(private readonly textToSpeechService: TextToSpeechService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Convert text to speech',
    description:
      'Generate audio from text using OpenAI TTS or ElevenLabs. Returns MP3 audio file.',
  })
  @ApiBody({
    type: GenerateSpeechDto,
    description: 'Text and voice configuration',
    examples: {
      example1: {
        value: {
          text: 'Hello, this is a test message.',
          voice: 'alloy',
        },
        description: 'Basic text-to-speech request',
      },
      example2: {
        value: {
          text: 'The capital of France is Paris.',
          voice: 'nova',
        },
        description: 'Text with different voice',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Audio generated successfully',
    content: {
      'audio/mpeg': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async generateSpeech(
    @Body() generateSpeechDto: GenerateSpeechDto,
    @Res() response: Response,
  ) {
    const audioBuffer = await this.textToSpeechService.generateSpeech(
      generateSpeechDto.text,
      generateSpeechDto.voice,
    );

    response.setHeader('Content-Type', 'audio/mpeg');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="speech.mp3"',
    );
    response.setHeader('Content-Length', audioBuffer.length);

    return response.send(audioBuffer);
  }

  @Post('generate/json')
  @ApiOperation({
    summary: 'Convert text to speech (JSON response)',
    description:
      'Generate audio from text and return as base64-encoded JSON. Useful for APIs that need JSON responses.',
  })
  @ApiBody({
    type: GenerateSpeechDto,
    description: 'Text and voice configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Audio generated successfully',
    schema: {
      properties: {
        audio: {
          type: 'string',
          description: 'Base64-encoded audio data',
        },
        provider: {
          type: 'string',
          enum: ['openai', 'elevenlabs', 'mock'],
          description: 'The TTS provider used',
        },
        duration: {
          type: 'number',
          description: 'Approximate duration in seconds',
        },
      },
    },
  })
  async generateSpeechJson(@Body() generateSpeechDto: GenerateSpeechDto) {
    const audioBuffer = await this.textToSpeechService.generateSpeech(
      generateSpeechDto.text,
      generateSpeechDto.voice,
    );

    return {
      audio: audioBuffer.toString('base64'),
      provider: 'openai',
      duration: Math.ceil(generateSpeechDto.text.length / 150), // Rough estimate
      message: 'Audio encoded in base64. Use in client-side: data:audio/mpeg;base64,<audio>',
    };
  }

  @Post('get-available-voices')
  @ApiOperation({
    summary: 'Get available voices',
    description: 'List all available voices for text-to-speech generation.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available voices',
    schema: {
      properties: {
        voices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async getAvailableVoices() {
    const openaiVoices = [
      {
        id: 'alloy',
        name: 'Alloy',
        description: 'Neutral, balanced voice',
      },
      {
        id: 'echo',
        name: 'Echo',
        description: 'Deep, warm voice',
      },
      {
        id: 'fable',
        name: 'Fable',
        description: 'Expressive, narrative voice',
      },
      {
        id: 'onyx',
        name: 'Onyx',
        description: 'Deep, masculine voice',
      },
      {
        id: 'nova',
        name: 'Nova',
        description: 'Bright, feminine voice',
      },
      {
        id: 'shimmer',
        name: 'Shimmer',
        description: 'Soft, gentle voice',
      },
    ];

    return {
      voices: openaiVoices,
      provider: 'openai',
    };
  }
}
