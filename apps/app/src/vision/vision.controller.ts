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

  private imageOrVideo(file: Express.Multer.File) {
    return file && ( /^image\//i.test(file.mimetype) || /^video\//i.test(file.mimetype) );
  }

  @Post('detect')
  @ApiOperation({
    summary: 'YOLO object detection on image',
    description: `Sends an image to the Vision/YOLO microservice for object detection. Returns detected objects with labels and confidence scores.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 200, description: 'Detections from YOLO' })
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: (req, file, cb) => {
        const ok = /^image\//i.test(file.mimetype) || /^video\//i.test(file.mimetype);
        if (ok) return cb(null, true);
        return cb(new Error('Only image or video files are allowed'), false);
      },
    }),
  )
  async detectFromFile(@UploadedFile() file: Express.Multer.File, @Res() res: any) {
    if (!file?.buffer) throw new BadRequestException('image file is required');
    if (!this.imageOrVideo(file)) throw new BadRequestException('Only image or video files are allowed');
    const detections = await this.visionService.detectObjects(file.buffer);
    return res.status(200).json({ success: true, message: 'Object detection complete', data: { detections }, status: 200 });
  }

  @Post('detect/base64')
  @ApiOperation({ summary: 'Object detection from base64 image' })
  @ApiBody({ schema: { type: 'object', required: ['imageBase64'], properties: { imageBase64: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Detections' })
  async detectFromBase64(@Body() body: { imageBase64: string }, @Res() res: any) {
    if (!body?.imageBase64) throw new BadRequestException('imageBase64 is required');
    const detections = await this.visionService.detectFromBase64(body.imageBase64);
    return res.status(200).json({ success: true, message: 'Object detection complete', data: { detections }, status: 200 });
  }

  @Post('ocr')
  @ApiOperation({ summary: 'OCR - extract text from image (papers, documents)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 200, description: 'Extracted text' })
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: (req, file, cb) => {
        const ok = /^image\//i.test(file.mimetype) || /^video\//i.test(file.mimetype);
        if (ok) return cb(null, true);
        return cb(new Error('Only image or video files are allowed'), false);
      },
    }),
  )
  async ocr(@UploadedFile() file: Express.Multer.File, @Res() res: any) {
    if (!file?.buffer) throw new BadRequestException('image file required');
    if (!this.imageOrVideo(file)) throw new BadRequestException('Only image or video files are allowed');
    const text = await this.visionService.extractText(file.buffer);
    return res.status(200).json({ success: true, message: 'OCR complete', data: { text }, status: 200 });
  }

  @Post('ocr/base64')
  @ApiOperation({ summary: 'OCR from base64 image' })
  @ApiBody({ schema: { type: 'object', required: ['imageBase64'], properties: { imageBase64: { type: 'string' } } } })
  async ocrBase64(@Body() body: { imageBase64: string }, @Res() res: any) {
    if (!body?.imageBase64) throw new BadRequestException('imageBase64 required');
    const buf = Buffer.from(body.imageBase64, 'base64');
    const text = await this.visionService.extractText(buf);
    return res.status(200).json({ success: true, message: 'OCR complete', data: { text }, status: 200 });
  }

  @Post('navigate')
  @ApiOperation({ summary: 'Navigation - obstacle detection with spoken hints' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: (req, file, cb) => {
        const ok = /^image\//i.test(file.mimetype) || /^video\//i.test(file.mimetype);
        if (ok) return cb(null, true);
        return cb(new Error('Only image or video files are allowed'), false);
      },
    }),
  )
  async navigate(@UploadedFile() file: Express.Multer.File, @Res() res: any) {
    if (!file?.buffer) throw new BadRequestException('image file required');
    if (!this.imageOrVideo(file)) throw new BadRequestException('Only image or video files are allowed');
    const result = await this.visionService.getNavigationHints(file.buffer);
    return res.status(200).json({ success: true, message: 'Navigation analysis complete', data: result, status: 200 });
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
  @ApiOperation({ summary: 'Full scene analysis: OCR + obstacles' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: (req, file, cb) => {
        const ok = /^image\//i.test(file.mimetype) || /^video\//i.test(file.mimetype);
        if (ok) return cb(null, true);
        return cb(new Error('Only image or video files are allowed'), false);
      },
    }),
  )
  async analyze(@UploadedFile() file: Express.Multer.File, @Res() res: any) {
    if (!file?.buffer) throw new BadRequestException('image file required');
    if (!this.imageOrVideo(file)) throw new BadRequestException('Only image or video files are allowed');
    const result = await this.visionService.analyzeScene(file.buffer);
    return res.status(200).json({ success: true, message: 'Scene analysis complete', data: result, status: 200 });
  }
}
