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
import { ObstacleDetectionService } from './obstacle-detection.service';
import sharp from 'sharp';

@ApiTags('Vision (Obstacle Detection)')
@Controller('vision')
export class VisionController {
  constructor(
    private readonly obstacleDetectionService: ObstacleDetectionService,
  ) {}

  private isImage(file: Express.Multer.File) {
    return file && /^image\//i.test(file.mimetype);
  }

  @Post('obstacle')
  @ApiOperation({
    summary: 'OPEN AI obstacles detection on image',
    description: `Sends an image to the OPEN AI Vision API for object detection. Returns detected objects with labels and confidence scores.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Detections from OPEN AI' })
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: (req, file, cb) => {
        const ok = /^image\//i.test(file.mimetype);
        if (ok) return cb(null, true);
        return cb(new Error('Only image files are allowed'), false);
      },
    }),
  )
  async detectFromFile(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: any,
  ) {
  async detectFromFile(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: any,
  ) {
    if (!file?.buffer) throw new BadRequestException('image file is required');
    if (!this.isImage(file))
      throw new BadRequestException('Only image files are allowed');

    let imageWidth = 640;
    let imageHeight = 480;

    try {
      const metadata = await sharp(file.buffer).metadata();

      if (metadata.width) imageWidth = metadata.width;
      if (metadata.height) imageHeight = metadata.height;
    } catch {}

    const { obstacles, processingTimeMs } =
      await this.obstacleDetectionService.detectObstacles(
        file.buffer,
        imageWidth,
        imageHeight,
        file.mimetype,
      );

    return res.status(200).json({
      success: true,
      message: 'Object detection complete',
      data: {
        imageInfo: { width: imageWidth, height: imageHeight },
        obstacles,
      },
      status: 200,
    });
  }
}
