import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { obstacleTypes, type ObstacleType, type BoundingBox } from './entities';

export interface DetectedObstacleResult {
  type: ObstacleType;
  confidence: number;
  boundingBox: BoundingBox;
  estimatedDistance: number | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DetectionResult {
  obstacles: DetectedObstacleResult[];
  processingTimeMs: number;
}

const DETECTION_PROMPT = `You are an obstacle detection system for a mobile navigation/safety application. Analyze this image and identify any obstacles that could be hazardous to a person walking or moving through this environment.

For each obstacle detected, provide:
- "type": one of these exact values: ${obstacleTypes.join(', ')}
- "confidence": a number between 0.0 and 1.0 representing detection confidence
- "boundingBox": {"x": number, "y": number, "width": number, "height": number} in pixel coordinates relative to image dimensions provided
- "estimatedDistance": estimated distance in meters from the camera (null if unknown)
- "severity": "low", "medium", "high", or "critical" based on how dangerous this obstacle is to a pedestrian

Image dimensions: WIDTH x HEIGHT pixels.

Respond ONLY with valid JSON in this exact format, no other text:
{
  "obstacles": [
    {
      "type": "vehicle",
      "confidence": 0.95,
      "boundingBox": {"x": 100, "y": 200, "width": 300, "height": 250},
      "estimatedDistance": 5.2,
      "severity": "high"
    }
  ]
}

If no obstacles are detected, respond with: {"obstacles": []}

Important rules:
- Only use the exact type values listed above
- Bounding box coordinates must be within the image dimensions
- Be thorough but accurate — only report obstacles you can actually see
- Estimate distance based on apparent size and position in the image`;

@Injectable()
export class ObstacleDetectionService {
  private readonly logger = new Logger(ObstacleDetectionService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private validateObstacle(
    obs: any,
    imageWidth: number,
    imageHeight: number,
  ): DetectedObstacleResult | null {
    if (!obs || typeof obs !== 'object') return null;

    const validTypes = obstacleTypes as readonly string[];
    if (!validTypes.includes(obs.type)) return null;

    const confidence = Number(obs.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) return null;

    const bb = obs.boundingBox;
    if (!bb || typeof bb !== 'object') return null;

    const x = Math.max(0, Math.min(Number(bb.x) || 0, imageWidth - 1));
    const y = Math.max(0, Math.min(Number(bb.y) || 0, imageHeight - 1));
    const width = Math.max(1, Math.min(Number(bb.width) || 1, imageWidth - x));
    const height = Math.max(
      1,
      Math.min(Number(bb.height) || 1, imageHeight - y),
    );

    const rawDistance =
      obs.estimatedDistance != null ? Number(obs.estimatedDistance) : null;
    const estimatedDistance =
      rawDistance !== null && !isNaN(rawDistance) && rawDistance >= 0
        ? rawDistance
        : null;

    const validSeverities = ['low', 'medium', 'high', 'critical'] as const;
    const severity = validSeverities.includes(obs.severity)
      ? (obs.severity as (typeof validSeverities)[number])
      : 'medium';

    return {
      type: obs.type as ObstacleType,
      confidence: parseFloat(confidence.toFixed(3)),
      boundingBox: {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      },
      estimatedDistance: estimatedDistance
        ? parseFloat(estimatedDistance.toFixed(1))
        : null,
      severity,
    };
  }

  async detectObstacles(
    imageBuffer: Buffer,
    imageWidth: number,
    imageHeight: number,
    mimeType: string,
  ): Promise<DetectionResult> {
    const startTime = Date.now();

    const base64Image = imageBuffer.toString('base64');
    const mediaType = mimeType || 'image/jpeg';

    const prompt = DETECTION_PROMPT.replace(
      'WIDTH',
      String(imageWidth),
    ).replace('HEIGHT', String(imageHeight));

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        this.logger.error('OpenAI returned empty response');
        return { obstacles: [], processingTimeMs: Date.now() - startTime };
      }

      const parsed = JSON.parse(content);
      const rawObstacles = Array.isArray(parsed.obstacles)
        ? parsed.obstacles
        : [];

      const obstacles: DetectedObstacleResult[] = rawObstacles
        .map((obs: any) => this.validateObstacle(obs, imageWidth, imageHeight))
        .filter(
          (obs: DetectedObstacleResult | null): obs is DetectedObstacleResult =>
            obs !== null,
        );

      obstacles.sort((a, b) => b.confidence - a.confidence);

      const processingTimeMs = Date.now() - startTime;
      return { obstacles, processingTimeMs };
    } catch (error: any) {
      this.logger.error(`OpenAI Vision API error: ${error.message}`);
      throw new Error(`Obstacle detection failed: ${error.message}`);
    }
  }
}
