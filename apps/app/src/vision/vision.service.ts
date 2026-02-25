import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { VisionDetectionEntity } from './entities/vision-detection.entity';

@Injectable()
export class VisionService {
  constructor(private readonly config: ConfigService) {}

  private getServiceUrl(): string {
    return (
      this.config.get<string>('vision.serviceUrl') || 'http://localhost:5000'
    );
  }

  /**
   * Send image buffer to YOLO vision microservice for object detection
   */
  async detectObjects(imageBuffer: Buffer): Promise<VisionDetectionEntity[]> {
    const baseUrl = this.getServiceUrl();
    const url = `${baseUrl}/detect`;

    const form = new FormData();
    form.append('image', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

    try {
      const { data } = await axios.post(url, form, {
        timeout: 30000,
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (Array.isArray(data.detections)) {
        return data.detections.map((d: any) => ({
          label: d.label || d.class || d.name || 'unknown',
          confidence: d.confidence ?? d.score ?? 0,
          bbox: d.bbox || d.box,
        }));
      }
      if (Array.isArray(data)) {
        return data.map((d: any) => ({
          label: d.label || d.class || d.name || 'unknown',
          confidence: d.confidence ?? d.score ?? 0,
          bbox: d.bbox || d.box,
        }));
      }
      return [];
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED') {
        return [
          {
            label: 'vision_service_unavailable',
            confidence: 0,
          },
        ];
      }
      throw err;
    }
  }

  /**
   * Receive base64 image (e.g. from ESP32-CAM) and run detection
   */
  async detectFromBase64(imageBase64: string): Promise<VisionDetectionEntity[]> {
    const buf = Buffer.from(imageBase64, 'base64');
    return this.detectObjects(buf);
  }

  /**
   * OCR - extract text from image (papers, documents)
   */
  async extractText(imageBuffer: Buffer): Promise<string> {
    const baseUrl = this.getServiceUrl();
    const url = `${baseUrl}/ocr`;
    const form = new FormData();
    form.append('image', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    try {
      const { data } = await axios.post(url, form, {
        timeout: 60000,
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return data?.text ?? '';
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED') {
        return '[Vision service unavailable. Start Python microservice: cd vision-service && python app.py]';
      }
      throw err;
    }
  }

  /**
   * Navigation - obstacle detection with spoken hints
   */
  async getNavigationHints(imageBuffer: Buffer): Promise<{
    obstacles: Array<{ label: string; confidence: number; hint?: string }>;
    hints: string[];
    speech: string;
  }> {
    const baseUrl = this.getServiceUrl();
    const url = `${baseUrl}/navigate`;
    const form = new FormData();
    form.append('image', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    try {
      const { data } = await axios.post(url, form, {
        timeout: 30000,
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return {
        obstacles: data?.obstacles ?? [],
        hints: data?.hints ?? [],
        speech: data?.speech ?? 'Path appears clear',
      };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED') {
        return {
          obstacles: [],
          hints: [],
          speech: 'Vision service unavailable. Start the Python microservice for obstacle detection.',
        };
      }
      throw err;
    }
  }

  /**
   * Full analysis: OCR + obstacles
   */
  async analyzeScene(imageBuffer: Buffer): Promise<{
    ocr: { text: string };
    obstacles: any[];
    hints: string[];
    speech: string;
  }> {
    const baseUrl = this.getServiceUrl();
    const url = `${baseUrl}/analyze`;
    const form = new FormData();
    form.append('image', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    try {
      const { data } = await axios.post(url, form, {
        timeout: 60000,
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return data ?? { ocr: { text: '' }, obstacles: [], hints: [], speech: '' };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED') {
        return {
          ocr: { text: '[Vision service unavailable]' },
          obstacles: [],
          hints: [],
          speech: 'Vision service unavailable.',
        };
      }
      throw err;
    }
  }
}
