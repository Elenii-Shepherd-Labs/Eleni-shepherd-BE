import { Body, Controller, Post, UploadedFile, UseInterceptors, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiConsumes, ApiProperty } from '@nestjs/swagger';
import { AudioProcessingService } from './audio-processing.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessChunkDto {
	@ApiProperty({ description: 'Session identifier' })
	@IsString()
	sessionId: string;

	@ApiProperty({ description: 'Base64-encoded WAV or audio chunk' })
	@IsString()
	audioBase64: string; // base64-encoded audio chunk

	@ApiProperty({ description: 'Sample rate (Hz)', required: false })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	sampleRate?: number;
}

export class AlwaysListenDto {
	@ApiProperty({ description: 'Session identifier' })
	@IsString()
	sessionId: string;

	@ApiProperty({ description: 'Enable or disable always-listen' })
	@IsBoolean()
	enabled: boolean;
}

export class TapToListenDto {
	@ApiProperty({ description: 'Session identifier' })
	@IsString()
	sessionId: string;
}

@Controller('audio-processing')
@ApiTags('audio-processing')
export class AudioProcessingController {
	private readonly logger = new Logger(AudioProcessingController.name);

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

	@Post('chunk-file')
	@ApiOperation({ summary: 'Upload WAV file (multipart) for processing' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({ schema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string', format: 'binary' } } } })
	@UseInterceptors(FileInterceptor('file'))
	@ApiResponse({ status: 200, description: 'Audio file processed', schema: { example: { transcript: 'hello world', isFinal: true } } })
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
	@ApiOperation({ summary: 'Enable/disable always-listening mode (requires wake word "Hey Eleni" to activate)' })
	@ApiBody({ type: AlwaysListenDto })
	@ApiResponse({ status: 200, description: 'Always-listen mode toggled', schema: { example: { sessionId: 'session-123', alwaysListening: true } } })
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
	@ApiOperation({ summary: 'Enable tap-to-listen mode (forces next utterance to be transcribed)' })
	@ApiBody({ type: TapToListenDto })
	@ApiResponse({ status: 200, description: 'Tap-to-listen activated', schema: { example: { sessionId: 'session-123', tapped: true } } })
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
