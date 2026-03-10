import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { VisionDetectionEntity } from './entities/vision-detection.entity';

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  private toBase64DataUrl(
    imageBuffer: Buffer,
    mimeType = 'image/jpeg',
  ): string {
    return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  }

  private async askVision(
    prompt: string,
    imageBuffer: Buffer,
    timeoutMs = 30000,
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.openai.chat.completions.create(
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: this.toBase64DataUrl(imageBuffer),
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 1024,
          response_format: { type: 'json_object' },
        },
        { signal: controller.signal },
      );
      return response.choices[0]?.message?.content ?? '{}';
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Send image buffer to OpenAI Vision for object detection.
   */
  async detectObjects(imageBuffer: Buffer): Promise<VisionDetectionEntity[]> {
    const prompt = `You are an object detection system. Analyze the image and list every distinct object you can identify.

Respond ONLY with valid JSON in this exact format, no other text:
{
  "detections": [
    { "label": "string", "confidence": 0.0-1.0, "bbox": { "x": 0, "y": 0, "w": 0, "h": 0 } }
  ]
}

Use pixel coordinates for bbox relative to the image dimensions. If nothing is detected respond with {"detections": []}.`;

    try {
      const raw = await this.askVision(prompt, imageBuffer);
      const parsed = JSON.parse(raw);
      const list: any[] = Array.isArray(parsed.detections)
        ? parsed.detections
        : Array.isArray(parsed)
        ? parsed
        : [];

      return list.map((d) => ({
        label: d.label || d.class || d.name || 'unknown',
        confidence: d.confidence ?? d.score ?? 0,
        bbox: d.bbox || d.box,
      }));
    } catch (err: any) {
      this.logger.error(`detectObjects error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Receive base64 image (e.g. from ESP32-CAM) and run detection.
   */
  async detectFromBase64(
    imageBase64: string,
  ): Promise<VisionDetectionEntity[]> {
    const buf = Buffer.from(imageBase64, 'base64');
    return this.detectObjects(buf);
  }

  /**
   * OCR - extract text from image (papers, documents).
   */
  async extractText(imageBuffer: Buffer): Promise<string> {
    const prompt = `You are an OCR engine. Extract all text visible in the image exactly as it appears.

Respond ONLY with valid JSON in this exact format, no other text:
{ "text": "extracted text here" }

If no text is found respond with { "text": "" }.`;

    try {
      const raw = await this.askVision(prompt, imageBuffer, 60000);
      const parsed = JSON.parse(raw);
      return parsed?.text ?? '';
    } catch (err: any) {
      this.logger.error(`extractText error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Navigation - obstacle detection with spoken hints.
   */
  async getNavigationHints(imageBuffer: Buffer): Promise<{
    obstacles: Array<{ label: string; confidence: number; hint?: string }>;
    hints: string[];
    speech: string;
  }> {
    const prompt = `You are a navigation assistant for a visually impaired person. Analyze the image for any obstacles or hazards in the path.

Respond ONLY with valid JSON in this exact format, no other text:
{
  "obstacles": [
    { "label": "string", "confidence": 0.0-1.0, "hint": "short plain-English instruction" }
  ],
  "hints": ["array of short plain-English navigation hints"],
  "speech": "one complete spoken sentence summarising the scene for a visually impaired person"
}

If no obstacles are present respond with { "obstacles": [], "hints": [], "speech": "Path appears clear" }.`;

    try {
      const raw = await this.askVision(prompt, imageBuffer);
      const parsed = JSON.parse(raw);
      return {
        obstacles: parsed?.obstacles ?? [],
        hints: parsed?.hints ?? [],
        speech: parsed?.speech ?? 'Path appears clear',
      };
    } catch (err: any) {
      this.logger.error(`getNavigationHints error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Full analysis: OCR + obstacles.
   */
  async analyzeScene(imageBuffer: Buffer): Promise<{
    ocr: { text: string };
    obstacles: any[];
    hints: string[];
    speech: string;
  }> {
    const prompt = `You are a scene analysis assistant for a visually impaired person. Analyse the image and perform both OCR and obstacle detection.

Respond ONLY with valid JSON in this exact format, no other text:
{
  "ocr": { "text": "all visible text in the image" },
  "obstacles": [
    { "label": "string", "confidence": 0.0-1.0, "hint": "short instruction" }
  ],
  "hints": ["array of short navigation hints"],
  "speech": "one complete spoken sentence describing the scene"
}

If nothing is found use empty strings / empty arrays.`;

    try {
      const raw = await this.askVision(prompt, imageBuffer, 60000);
      const parsed = JSON.parse(raw);
      return {
        ocr: parsed?.ocr ?? { text: '' },
        obstacles: parsed?.obstacles ?? [],
        hints: parsed?.hints ?? [],
        speech: parsed?.speech ?? '',
      };
    } catch (err: any) {
      this.logger.error(`analyzeScene error: ${err.message}`);
      throw err;
    }
  }
}
