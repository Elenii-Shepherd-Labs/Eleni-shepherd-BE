import {
  Controller,
  Post,
  Body,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { VisionService } from './vision.service';

@ApiTags('Vision (Object Detection)')
@Controller('vision')
export class VisionController {
  constructor(private readonly visionService: VisionService) {}

  @Post('detect')
  @ApiOperation({
    summary: 'YOLO object detection on image',
    description: `
Sends an image to the Vision/YOLO microservice for object detection.
Returns detected objects with labels and confidence scores.

**Frontend Implementation**:
\`\`\`typescript
const formData = new FormData();
formData.append('image', imageFile);

const response = await fetch('http://localhost:3000/vision/detect', {
  method: 'POST',
  body: formData,
  credentials: 'include',
});
const result = await response.json();
// result.data.detections = [{ label: 'person', confidence: 0.95 }, ...]
\`\`\`

**Requires**: Python vision microservice running (VISION_SERVICE_URL, default localhost:5000)
**Response**: Array of { label, confidence, bbox? }
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary', description: 'Image file (JPEG/PNG)' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Detections from YOLO',
    schema: {
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            detections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  confidence: { type: 'number' },
                  bbox: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async detectFromFile(@UploadedFile() file: Express.Multer.File, @Res() res: any) {
    if (!file?.buffer) {
      throw new BadRequestException('image file is required');
    }
    const detections = await this.visionService.detectObjects(file.buffer);
    return res.status(200).json({
      success: true,
      message: 'Object detection complete',
      data: { detections },
      status: 200,
    });
  }

  @Post('detect/base64')
  @ApiOperation({
    summary: 'Object detection from base64 image (ESP32-CAM)',
    description: `
Receives base64-encoded image chunks (e.g. from ESP32-CAM) and runs YOLO detection.
Use for hardware that sends images as base64.

**ESP32-CAM Integration**:
\`\`\`c
// Send JPEG frame as base64 to this endpoint
HTTP POST /vision/detect/base64
Body: { "imageBase64": "<base64 string>" }
\`\`\`

**Frontend/Device**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/vision/detect/base64', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageBase64: base64String }),
});
const result = await response.json();
\`\`\`
    `,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['imageBase64'],
      properties: {
        imageBase64: { type: 'string', description: 'Base64-encoded image' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Detections',
    schema: {
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            detections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  confidence: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  })
  async detectFromBase64(
    @Body() body: { imageBase64: string },
    @Res() res: any,
  ) {
    if (!body?.imageBase64) {
      throw new BadRequestException('imageBase64 is required');
    }
    const detections = await this.visionService.detectFromBase64(
      body.imageBase64,
    );
    return res.status(200).json({
      success: true,
      message: 'Object detection complete',
      data: { detections },
      status: 200,
    });
  }

  @Post('ocr')
  @ApiOperation({
    summary: 'OCR - extract text from image (papers, documents)',
    description: `
Extract text from images (papers, receipts, signs) for TTS reading aloud.
Designed for visually impaired users - capture image, get text, speak it.

**Frontend Implementation**:
\`\`\`typescript
const formData = new FormData();
formData.append('image', imageFile);
const res = await fetch('http://localhost:3000/vision/ocr', { method: 'POST', body: formData });
const { data } = await res.json();
// data.text = extracted text
// Then call /accessibility/read-aloud with data.text
\`\`\`

**Requires**: Python vision microservice with pytesseract or easyocr
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 200, description: 'Extracted text' })
  @UseInterceptors(FileInterceptor('image'))
  async ocr(@UploadedFile() file: Express.Multer.File, @Res() res: any) {
    if (!file?.buffer) throw new BadRequestException('image file required');
    const text = await this.visionService.extractText(file.buffer);
    return res.status(200).json({
      success: true,
      message: 'OCR complete',
      data: { text },
      status: 200,
    });
  }

  @Post('ocr/base64')
  @ApiOperation({
    summary: 'OCR from base64 image (e.g. ESP32-CAM)',
  })
  @ApiBody({ schema: { type: 'object', required: ['imageBase64'], properties: { imageBase64: { type: 'string' } } } })
  async ocrBase64(@Body() body: { imageBase64: string }, @Res() res: any) {
    if (!body?.imageBase64) throw new BadRequestException('imageBase64 required');
    const buf = Buffer.from(body.imageBase64, 'base64');
    const text = await this.visionService.extractText(buf);
    return res.status(200).json({ success: true, message: 'OCR complete', data: { text }, status: 200 });
  }

  @Post('navigate')
  @ApiOperation({
    summary: 'Navigation - obstacle detection with spoken hints',
    description: `
Detect obstacles for navigation. Returns objects and TTS-ready hints
(e.g. "Person ahead, proceed with caution", "Chair in path").
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('image'))
  async navigate(@UploadedFile() file: Express.Multer.File, @Res() res: any) {
    if (!file?.buffer) throw new BadRequestException('image file required');
    const result = await this.visionService.getNavigationHints(file.buffer);
    return res.status(200).json({
      success: true,
      message: 'Navigation analysis complete',
      data: result,
      status: 200,
    });
  }

  @Post('navigate/base64')
  @ApiOperation({ summary: 'Navigation from base64 (ESP32-CAM)' })
  @ApiBody({ schema: { type: 'object', required: ['imageBase64'], properties: { imageBase64: { type: 'string' } } } })
  async navigateBase64(@Body() body: { imageBase64: string }, @Res() res: any) {
    if (!body?.imageBase64) throw new BadRequestException('imageBase64 required');
    const buf = Buffer.from(body.imageBase64, 'base64');
    const result = await this.visionService.getNavigationHints(buf);
    return res.status(200).json({ success: true, message: 'Navigation analysis complete', data: result, status: 200 });
  }

  @Post('analyze')
  @ApiOperation({
    summary: 'Full scene analysis: OCR + obstacles',
    description: 'Combines OCR and navigation for comprehensive scene understanding.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('image'))
  async analyze(@UploadedFile() file: Express.Multer.File, @Res() res: any) {
    if (!file?.buffer) throw new BadRequestException('image file required');
    const result = await this.visionService.analyzeScene(file.buffer);
    return res.status(200).json({
      success: true,
      message: 'Scene analysis complete',
      data: result,
      status: 200,
    });
  }
}
