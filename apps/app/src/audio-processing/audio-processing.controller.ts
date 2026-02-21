import { Body, Controller, Post, UploadedFile, UseInterceptors, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { AudioProcessingService } from './audio-processing.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProcessChunkDto, AlwaysListenDto, TapToListenDto } from './dto';

@Controller('audio-processing')
@ApiTags('Audio Processing')
export class AudioProcessingController {
	private readonly logger = new Logger(AudioProcessingController.name);

	constructor(private readonly audioService: AudioProcessingService) {}

	@Post('chunk')
	@ApiOperation({
		summary: 'Process audio chunk for transcription',
		description: `
Process a base64-encoded audio chunk for transcription.

Supports both **Always-Listen** and **Tap-to-Listen** modes.

**Frontend Implementation**:
\`\`\`typescript
const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

const response = await fetch('http://localhost:3000/audio-processing/chunk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'session-123',
    audioBase64,
    sampleRate: 16000, // 16 kHz
  }),
  credentials: 'include',
});

const result = await response.json();
console.log('Transcript:', result.data.transcript);
\`\`\`

**Parameters**:
- \`sessionId\` (required): Session ID from conversational-ai
- \`audioBase64\` (required): Base64-encoded audio data
- \`sampleRate\` (optional): Sample rate in Hz. Default: 16000

**Audio Format**:
- PCM16 (16-bit signed)
- Mono or Stereo (will be converted to mono)
- Common sample rates: 16000 Hz, 44100 Hz, 48000 Hz

**Response**:
- \`transcript\`: Transcribed text
- \`isFinal\`: Whether this is final transcription
- \`confidence\`: Confidence score (0-1)

**Use Cases**:
- Process streaming audio chunks
- Real-time transcription
- Integration with WebRTC audio capture

**Encoding Audio in Frontend**:
\`\`\`typescript
// From AudioContext
const audioBuffer = audioContext.createBuffer(...);
const data = audioBuffer.getChannelData(0);
const int16 = new Int16Array(data.length);
for (let i = 0; i < data.length; i++) {
  int16[i] = data[i] < 0 ? data[i] * 0x8000 : data[i] * 0x7FFF;
}
const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
\`\`\`
		`,
	})
	@ApiBody({ type: ProcessChunkDto })
	@ApiResponse({
		status: 200,
		description: 'Audio chunk processed',
		schema: {
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string' },
				data: {
					type: 'object',
					properties: {
						transcript: { type: 'string', example: 'hello world' },
						isFinal: { type: 'boolean', example: true },
						confidence: { type: 'number', example: 0.95 },
					},
				},
			},
		},
	})
	async processChunk(@Body() body: ProcessChunkDto) {
		const { sessionId, audioBase64, sampleRate } = body;
		const audioChunk = Buffer.from(audioBase64, 'base64');

		const result = await this.audioService.processAudioChunk(
			sessionId,
			audioChunk,
			sampleRate || 16000,
		);

		return result;
	}

	@Post('chunk-file')
	@ApiOperation({
		summary: 'Upload WAV/audio file for processing',
		description: `
Upload an audio file (multipart) for transcription and processing.

Useful for handling file uploads from HTML file inputs or recorded audio blobs.

**Frontend Implementation (File Input)**:
\`\`\`typescript
const handleFileUpload = async (file: File, sessionId: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sessionId', sessionId);

  const response = await fetch('http://localhost:3000/audio-processing/chunk-file', {
    method: 'POST',
    body: formData, // Don't set Content-Type header!
    credentials: 'include',
  });

  const result = await response.json();
  console.log('Transcript:', result.data.transcript);
};
\`\`\`

**Frontend Implementation (Blob from Recording)**:
\`\`\`typescript
// Using MediaRecorder API
const mediaRecorder = new MediaRecorder(stream);
const chunks = [];

mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
mediaRecorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('file', blob);
  formData.append('sessionId', sessionId);

  const response = await fetch('http://localhost:3000/audio-processing/chunk-file', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  
  const result = await response.json();
};
\`\`\`

**Supported Formats**: WAV, MP3, WebM, MPEG, M4A

**Parameters** (Form Data):
- \`file\` (required): Audio file
- \`sessionId\` (required): Conversation session ID

**Returns**: Same format as /chunk endpoint

**Use Cases**:
- Process user-uploaded audio files
- Handle recorded audio blobs
- Support file drag-and-drop
- Better UX than base64 encoding
		`,
	})
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				sessionId: { type: 'string', description: 'Conversation session ID' },
				file: { type: 'string', format: 'binary', description: 'Audio file to process' },
			},
			required: ['sessionId', 'file'],
		},
	})
	@UseInterceptors(FileInterceptor('file'))
	@ApiResponse({
		status: 200,
		description: 'Audio file processed',
		schema: {
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string' },
				data: {
					type: 'object',
					properties: {
						transcript: { type: 'string', example: 'hello world' },
						isFinal: { type: 'boolean', example: true },
					},
				},
			},
		},
	})
	async processChunkFile(@Body() body: any, @UploadedFile() file: Express.Multer.File) {
		this.logger.debug(`processChunkFile received body: ${JSON.stringify(body)}`);

		const sessionId = body?.sessionId;

		if (!sessionId) {
			throw new BadRequestException('sessionId is required in form data');
		}

		if (!file) {
			throw new BadRequestException('file is required');
		}

		const audioChunk = file.buffer;

		const result = await this.audioService.processAudioChunk(
			sessionId,
			audioChunk,
			16000,
		);

		return result;
	}

	@Post('always-listen')
	@ApiOperation({
		summary: 'Enable/disable always-listening mode',
		description: `
Toggle "Always-Listening" mode for hands-free operation.

In this mode, the system listens continuously. Users say the wake-word "**Hey Eleni**" to activate transcription.

**Frontend Implementation**:
\`\`\`typescript
// Enable always-listening
const response = await fetch('http://localhost:3000/audio-processing/always-listen', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'session-123',
    enabled: true,
  }),
  credentials: 'include',
});

const result = await response.json();
console.log('Always-listening enabled:', result.data.alwaysListening);

// Disable
await fetch('...', {
  body: JSON.stringify({ sessionId: 'session-123', enabled: false }),
});
\`\`\`

**Workflow**:
1. Enable always-listening: \`enabled: true\`
2. System continuously monitors audio
3. Detects wake-word "Hey Eleni"
4. Auto-transcribes next utterance
5. Sends transcript to LLM
6. Listens for next wake-word
7. Disable when needed: \`enabled: false\`

**Audio Stream Requirements**:
- Continuous audio stream to backend
- Can use WebRTC or WebSocket
- Typical: 16kHz, mono, 16-bit PCM

**Parameters**:
- \`sessionId\` (required): Conversation session ID
- \`enabled\` (required): true to enable, false to disable

**Returns**: Current mode state

**Use Cases**:
- Hands-free voice assistant
- Smart home integration
- Accessibility feature
- Always-on voice control
		`,
	})
	@ApiBody({ type: AlwaysListenDto })
	@ApiResponse({
		status: 200,
		description: 'Always-listen mode toggled',
		schema: {
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string' },
				data: {
					type: 'object',
					properties: {
						sessionId: { type: 'string', example: 'session-123' },
						alwaysListening: { type: 'boolean', example: true },
					},
				},
			},
		},
	})
	async setAlwaysListen(@Body() body: any) {
		this.logger.debug(`setAlwaysListen received body: ${JSON.stringify(body)}`);

		const { sessionId, enabled } = body || {};

		if (!sessionId) {
			throw new BadRequestException('sessionId is required');
		}

		await this.audioService.setAlwaysListening(sessionId, !!enabled);
		return { sessionId, alwaysListening: !!enabled };
	}

	@Post('tap-to-listen')
	@ApiOperation({
		summary: 'Enable tap-to-listen mode (one-shot recording)',
		description: `
Activate "Tap-to-Listen" mode for explicit voice input.

The user taps a button, and the next audio chunk is transcribed. Simpler than always-listening for push-to-talk interactions.

**Frontend Implementation**:
\`\`\`typescript
const handleTapToListen = async (sessionId: string) => {
  // User taps button - activate tap-to-listen
  const response = await fetch('http://localhost:3000/audio-processing/tap-to-listen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
    credentials: 'include',
  });

  const result = await response.json();
  console.log('Tap activated:', result.data.tapped);

  // Now capture one audio chunk and send to /chunk endpoint
  // System transcribes and processes automatically
};
\`\`\`

**Workflow**:
1. User presses "Tap to Speak" button
2. Call this endpoint to activate
3. Start recording audio
4. Stop recording and send audio to /chunk endpoint
5. System auto-transcribes and processes
6. Back to idle/listening state

**Parameters**:
- \`sessionId\` (required): Conversation session ID

**Returns**: Confirmation that tap-to-listen is activated

**Comparison with Always-Listen**:
| Feature | Always-Listen | Tap-to-Listen |
|---------|---------------|---------------|
| Wake-word required | Yes | No |
| User initiation | Automatic | Manual (button) |
| Latency | Higher (wake-word detection) | Lower (immediate) |
| Privacy | Continuous listening | Explicit input only |
| Battery usage | Higher | Lower |
| UX | Hands-free | Push-to-talk |

**Use Cases**:
- Voice search
- Voice commands
- Interactive voice response
- Assistive technology
- Privacy-conscious applications
		`,
	})
	@ApiBody({ type: TapToListenDto })
	@ApiResponse({
		status: 200,
		description: 'Tap-to-listen activated',
		schema: {
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string' },
				data: {
					type: 'object',
					properties: {
						sessionId: { type: 'string', example: 'session-123' },
						tapped: { type: 'boolean', example: true },
					},
				},
			},
		},
	})
	async tapToListen(@Body() body: any) {
		this.logger.debug(`tapToListen received body: ${JSON.stringify(body)}`);

		const { sessionId } = body || {};

		if (!sessionId) {
			throw new BadRequestException('sessionId is required');
		}

		await this.audioService.tapToListen(sessionId);
		return { sessionId, tapped: true };
	}
}
