import { Controller, Post, Body, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { TextToSpeechService } from '../text-to-speech/text-to-speech.service';
import { VisionService } from '../vision/vision.service';

@ApiTags('Accessibility (Screen Reader)')
@Controller('accessibility')
export class AccessibilityController {
  constructor(
    private readonly ttsService: TextToSpeechService,
    private readonly visionService: VisionService,
  ) {}

  @Post('read-aloud')
  @ApiOperation({
    summary: 'Read content aloud (screen reader)',
    description: `
Converts text to speech for accessibility. Designed for users with visual impairments - reads screen content aloud.

**Frontend Implementation**:
\`\`\`typescript
// Read article title and description
const response = await fetch('http://localhost:3000/accessibility/read-aloud', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Welcome to Eleni Shepherd. You have 3 new articles.',
    voice: 'nova',
  }),
  credentials: 'include',
});

const audioBlob = await response.blob();
const audio = new Audio(URL.createObjectURL(audioBlob));
audio.play();
\`\`\`

**Use with Blog/Radio**:
1. Fetch articles from /blog
2. For each article, call read-aloud with title + description
3. Or stream radio from /radio-stations

**Voice options**: alloy, echo, fable, onyx, nova, shimmer
**Response**: MP3 binary (same as /text-to-speech/generate)
    `,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string', description: 'Content to read aloud' },
        voice: { type: 'string', default: 'nova', description: 'TTS voice' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'MP3 audio binary',
    content: { 'audio/mpeg': { schema: { type: 'string', format: 'binary' } } },
  })
  async readAloud(
    @Body() body: { text: string; voice?: string },
    @Res() response: any,
  ) {
    const resp = await this.ttsService.generateSpeech(
      body.text,
      body.voice || 'nova',
    );
    if (!resp.success) {
      return response.status(resp.status || 500).json(resp);
    }
    const buf = resp.data as Buffer;
    response.setHeader('Content-Type', 'audio/mpeg');
    response.setHeader('Content-Disposition', 'attachment; filename="read-aloud.mp3"');
    response.setHeader('Content-Length', buf.length);
    return response.status(200).send(buf);
  }

  @Post('read-image-aloud')
  @ApiOperation({
    summary: 'OCR + TTS: extract text from image and read aloud',
    description: `
Capture image (paper, sign, receipt) -> OCR extracts text -> TTS reads it aloud.
One-step flow for visually impaired users.
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('image'))
  @ApiResponse({ status: 200, description: 'MP3 audio of extracted text' })
  async readImageAloud(@UploadedFile() file: Express.Multer.File, @Res() res: any) {
    if (!file?.buffer) {
      return res.status(400).json({ success: false, message: 'image file required' });
    }
    const text = await this.visionService.extractText(file.buffer);
    const toRead = text || 'No text could be extracted from this image.';
    const resp = await this.ttsService.generateSpeech(toRead, 'nova');
    if (!resp.success) {
      return res.status(resp.status || 500).json(resp);
    }
    const buf = resp.data as Buffer;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="read-image.mp3"');
    res.setHeader('Content-Length', buf.length);
    return res.status(200).send(buf);
  }

  @Post('navigate-and-speak')
  @ApiOperation({
    summary: 'Obstacle detection + TTS: speak navigation hints aloud',
    description: 'Capture image -> detect obstacles -> speak hints (e.g. "Chair in path")',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('image'))
  @ApiResponse({ status: 200, description: 'MP3 audio of navigation hints' })
  async navigateAndSpeak(@UploadedFile() file: Express.Multer.File, @Res() res: any) {
    if (!file?.buffer) {
      return res.status(400).json({ success: false, message: 'image file required' });
    }
    const { speech } = await this.visionService.getNavigationHints(file.buffer);
    const resp = await this.ttsService.generateSpeech(speech, 'nova');
    if (!resp.success) {
      return res.status(resp.status || 500).json(resp);
    }
    const buf = resp.data as Buffer;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="navigate.mp3"');
    res.setHeader('Content-Length', buf.length);
    return res.status(200).send(buf);
  }
}
