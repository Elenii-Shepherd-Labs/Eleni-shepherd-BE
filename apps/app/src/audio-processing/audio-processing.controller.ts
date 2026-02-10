import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AudioProcessingService } from './audio-processing.service';

export class ProcessChunkDto {
	sessionId: string;
	audioBase64: string; // base64-encoded audio chunk
	sampleRate?: number;
}

export class AlwaysListenDto {
	sessionId: string;
	enabled: boolean;
}

export class TapToListenDto {
	sessionId: string;
}

@Controller('audio-processing')
@ApiTags('audio-processing')
export class AudioProcessingController {
	constructor(private readonly audioService: AudioProcessingService) {}

	@Post('chunk')
	@ApiOperation({ summary: 'Process audio chunk for transcription (supports always-listen and tap-to-listen)' })
	@ApiBody({ type: ProcessChunkDto })
	@ApiResponse({ status: 200, description: 'Audio chunk processed', schema: { example: { transcript: 'hello world', isFinal: true } } })
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

	@Post('always-listen')
	@ApiOperation({ summary: 'Enable/disable always-listening mode (requires wake word "Hey Eleni" to activate)' })
	@ApiBody({ type: AlwaysListenDto })
	@ApiResponse({ status: 200, description: 'Always-listen mode toggled', schema: { example: { sessionId: 'session-123', alwaysListening: true } } })
	async setAlwaysListen(@Body() body: AlwaysListenDto) {
		const { sessionId, enabled } = body;
		await this.audioService.setAlwaysListening(sessionId, !!enabled);
		return { sessionId, alwaysListening: !!enabled };
	}

	@Post('tap-to-listen')
	@ApiOperation({ summary: 'Enable tap-to-listen mode (forces next utterance to be transcribed)' })
	@ApiBody({ type: TapToListenDto })
	@ApiResponse({ status: 200, description: 'Tap-to-listen activated', schema: { example: { sessionId: 'session-123', tapped: true } } })
	async tapToListen(@Body() body: TapToListenDto) {
		const { sessionId } = body;
		await this.audioService.tapToListen(sessionId);
		return { sessionId, tapped: true };
	}
}
