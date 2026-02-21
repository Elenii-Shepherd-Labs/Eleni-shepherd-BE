import { Controller, Post, Body, Res, HttpException } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { TextToSpeechService } from './text-to-speech.service';
import { GenerateSpeechDto, SpeechResponseDto } from './dto';

@ApiTags('Text-to-Speech')
@Controller('text-to-speech')
export class TextToSpeechController {
  constructor(private readonly textToSpeechService: TextToSpeechService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Convert text to speech (audio file)',
    description: `
Generate audio from text using OpenAI TTS. Returns MP3 audio file for streaming/download.

**Frontend Implementation (Fetch + Audio)**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/text-to-speech/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello, this is a test message.',
    voice: 'nova',
  }),
  credentials: 'include',
});

const audioBlob = await response.blob();
const audioUrl = URL.createObjectURL(audioBlob);
const audio = new Audio(audioUrl);
audio.play();
\`\`\`

**Frontend Implementation (React Hook)**:
\`\`\`typescript
const handleGenerateSpeech = async (text: string, voice: string) => {
  try {
    const response = await fetch('http://localhost:3000/text-to-speech/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      setError(error.message);
      return;
    }

    const audioBlob = await response.blob();
    setAudioUrl(URL.createObjectURL(audioBlob));
    setIsPlaying(false);
  } catch (error) {
    setError('Failed to generate speech');
  }
};
\`\`\`

**Available Voices**:
- \`alloy\` - Neutral, balanced
- \`echo\` - Deep, warm
- \`fable\` - Expressive, narrative
- \`onyx\` - Deep, masculine
- \`nova\` - Bright, feminine (recommended)
- \`shimmer\` - Soft, gentle

**Response Type**: Binary MP3 audio data

**Use Cases**:
- Play text as speech in app
- Download audio files
- Generate voiceovers
- Accessibility features
    `,
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
    description: 'Audio generated successfully - returns MP3 binary data',
    content: {
      'audio/mpeg': {
        schema: {
          type: 'string',
          format: 'binary',
          description: 'MP3 audio file data',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid voice or missing text',
  })
  async generateSpeech(
    @Body() generateSpeechDto: GenerateSpeechDto,
    @Res() response: Response,
  ) {
    const resp = await this.textToSpeechService.generateSpeech(
      generateSpeechDto.text,
      generateSpeechDto.voice,
    );

    if (!resp.success) {
      return response.status(resp.status || 500).json(resp);
    }

    const audioBuffer = resp.data as Buffer;

    response.setHeader('Content-Type', 'audio/mpeg');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="speech.mp3"',
    );
    response.setHeader('Content-Length', audioBuffer.length);

    response.status(resp.status || 200);
    return response.send(audioBuffer);
  }

  @Post('generate/json')
  @ApiOperation({
    summary: 'Convert text to speech (base64 JSON)',
    description: `
Generate audio from text and return as base64-encoded JSON response.

Useful when you need JSON responses instead of binary streams (e.g., API chaining, logging).

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/text-to-speech/generate/json', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello, world!',
    voice: 'nova',
  }),
  credentials: 'include',
});

const result = await response.json();
if (result.success) {
  const audioData = \`data:audio/mpeg;base64,\${result.data.audio}\`;
  const audio = new Audio(audioData);
  audio.play();
}
\`\`\`

**Response Fields**:
- \`audio\`: Base64-encoded MP3 data (can be used as data URI)
- \`provider\`: Provider used (openai, elevenlabs, etc.)
- \`duration\`: Approximate duration in seconds
- \`message\`: Usage hint for frontend

**Advantages over /generate**:
- Returns JSON (easier to log/track)
- Works with API chaining
- Suitable for storing audio data
- Better for error handling in JSON format

**Disadvantages**:
- Base64 increases payload size by ~33%
- Slower for large audio files
- Not suitable for streaming
    `,
  })
  @ApiBody({
    type: GenerateSpeechDto,
    description: 'Text and voice configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Audio generated successfully - returns base64 JSON',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            audio: {
              type: 'string',
              description: 'Base64-encoded MP3 audio data. Use as data:audio/mpeg;base64,...',
            },
            provider: {
              type: 'string',
              enum: ['openai', 'elevenlabs', 'mock'],
              example: 'openai',
            },
            duration: {
              type: 'number',
              description: 'Approximate audio duration in seconds',
              example: 2.5,
            },
          },
        },
      },
    },
  })
  async generateSpeechJson(@Body() generateSpeechDto: GenerateSpeechDto) {
    const resp = await this.textToSpeechService.generateSpeech(
      generateSpeechDto.text,
      generateSpeechDto.voice,
    );

    if (!resp.success) {
      throw new HttpException(resp.message, resp.status || 500);
    }

    const audioBuffer = resp.data as Buffer;

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
    description: `
Retrieve list of all available voices for text-to-speech generation.

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/text-to-speech/get-available-voices', {
  method: 'POST',
  credentials: 'include',
});
const result = await response.json();
console.log('Available voices:', result.data.voices);
\`\`\`

**Use Cases**:
- Populate voice selector dropdowns
- Display voice options to users
- Validate voice parameters before API call
- Show voice descriptions/characteristics
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'List of available voices',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            voices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'nova' },
                  name: { type: 'string', example: 'Nova' },
                  description: { type: 'string', example: 'Bright, feminine voice' },
                },
              },
            },
            provider: { type: 'string', example: 'openai' },
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
