import { Controller, Post, Body, UseInterceptors, UploadedFile, BadRequestException, HttpException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { SpeechToTextService } from './speech-to-text.service';
import { TranscribeAudioDto, TranscriptionResponseDto } from './dto';

@ApiTags('Speech-to-Text')
@Controller('speech-to-text')
export class SpeechToTextController {
  constructor(private readonly speechToTextService: SpeechToTextService) {}

  @Post('transcribe')
  @ApiOperation({
    summary: 'Transcribe audio to text',
    description: `
Convert speech in audio files to text using OpenAI Whisper API.

**Supported Formats**: WAV, MP3, MPEG, MPGA, M4A, WebM

**Frontend Implementation (Fetch)**:
\`\`\`typescript
const formData = new FormData();
formData.append('audioFile', audioFile); // File object
formData.append('language', 'en'); // Optional

const response = await fetch('http://localhost:3000/speech-to-text/transcribe', {
  method: 'POST',
  body: formData,
  credentials: 'include',
});
const result = await response.json();
console.log('Transcribed text:', result.data.text);
\`\`\`

**Frontend Implementation (React)**:
\`\`\`typescript
const handleAudioUpload = async (audioFile: File) => {
  const formData = new FormData();
  formData.append('audioFile', audioFile);

  try {
    const response = await fetch('http://localhost:3000/speech-to-text/transcribe', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const data = await response.json();
    
    if (data.success) {
      setText(data.data.text);
    } else {
      setError(data.message);
    }
  } catch (error) {
    setError('Upload failed');
  }
};
\`\`\`

**Response**:
- \`text\`: The transcribed text
- \`isFinal\`: Whether transcription is final
- \`provider\`: The provider used (openai)

**Limitations**:
- Max file size should be reasonable (test with your infrastructure)
- API key must be configured (see .env setup)
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audioFile: {
          type: 'string',
          format: 'binary',
          description: 'Audio file to transcribe (WAV, MP3, WebM, etc.)',
        },
        language: {
          type: 'string',
          description: 'ISO 639-1 language code (en, es, fr, de, etc.). Defaults to auto-detect.',
          example: 'en',
        },
      },
      required: ['audioFile'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Audio transcribed successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Transcribed text', example: 'Hello, how are you?' },
            isFinal: { type: 'boolean', example: true },
            provider: { type: 'string', example: 'openai' },
          },
        },
        status: { type: 'number', example: 200 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'No audio file provided',
  })
  @UseInterceptors(FileInterceptor('audioFile'))
  async transcribeAudio(
    @UploadedFile() file: any,
    @Body() body: { language?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No audio file provided');
    }

    const resp = await this.speechToTextService.transcribeAudio(
      file.buffer,
      body.language,
    );

    if (!resp.success) {
      throw new HttpException(resp.message, resp.status || 500);
    }

    const data = resp.data as { text: string; isFinal: boolean };

    return {
      text: data.text,
      isFinal: data.isFinal,
      provider: 'openai',
    };
  }

  @Post('voice-activity-detection')
  @ApiOperation({
    summary: 'Detect voice activity in audio',
    description: `
Analyze audio and detect whether it contains voice activity.

Uses energy-based voice activity detection (VAD) algorithm.

**Frontend Implementation**:
\`\`\`typescript
const formData = new FormData();
formData.append('audioFile', audioFile);
formData.append('threshold', '500'); // Optional

const response = await fetch('http://localhost:3000/speech-to-text/voice-activity-detection', {
  method: 'POST',
  body: formData,
  credentials: 'include',
});
const result = await response.json();
console.log('Voice detected:', result.data.voiceDetected);
\`\`\`

**Parameters**:
- \`audioFile\` (required): Audio file to analyze
- \`threshold\` (optional): Energy threshold for detection. Lower = more sensitive. Default: 500

**Returns**:
- \`voiceDetected\` (boolean): Whether voice activity was detected
- \`audioLength\` (number): Length of audio in bytes

**Use Cases**:
- Pre-check before transcription (skip if no voice)
- Voice activity detection for tap-to-listen
- Audio quality assessment
- Wake-word verification
    `,
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
          description: 'Energy threshold for voice detection (0-1000). Lower = more sensitive.',
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
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            voiceDetected: { type: 'boolean', description: 'Whether voice was detected', example: true },
            audioLength: { type: 'number', description: 'Audio length in bytes', example: 32000 },
          },
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
      throw new BadRequestException('No audio file provided');
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
