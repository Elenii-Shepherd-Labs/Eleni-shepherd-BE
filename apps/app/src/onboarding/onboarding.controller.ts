import {
  Post,
  Body,
  Controller,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Express, Request, Response } from 'express';
import { TranscriptionService } from './transcription.service';
import { extname } from 'path';
import fs from 'fs';
import { OnboardingService } from './onboarding.service';
import { SaveNameAsTextDTO } from './saveNameAsText.dto';
import { SaveFullameDto } from './saveFullame.dto';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UploadDto } from './upload.dto';

UseGuards(AuthGuard('google'));
@Controller('onboard')
export class OnboardingController {
  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly onboardingService: OnboardingService,
  ) {}
  @Post('name')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({
        destination: '/tmp',
        filename: (_, file, callback) => {
          const unique = `${Date.now()} - ${Math.random()
            .toString(36)
            .slice(2)}`;
          callback(null, unique + extname(file.originalname));
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10mb
      },
      fileFilter: (_, file, callback) => {
        if (!file.mimetype.startsWith('audio/')) {
          return callback(
            new BadRequestException('Only audio files allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiBody({
    type: UploadDto,
    description:
      'Audio file must be less than 10MB in one of the following formats: mp3, mp4, mpeg, mpga, m4a, wav, or webm',
  })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({
    description: 'The name has been successfully saved',
    type: SaveFullameDto,
  })
  async saveNameAsText(
    @Req() req: Request,
    @Query() query: SaveNameAsTextDTO,
    @UploadedFile() audioFile: Express.Multer.File,
  ) {
    if (!audioFile) {
      throw new BadRequestException('Audio file is required');
    }

    const text = await this.transcriptionService.transcribeFromFile(
      audioFile.path,
    );

    const cleanedName = text.replace(/[^a-zA-Z]/g, '');
    const userId = req.user['id'];
    const fullname = await this.onboardingService.saveName(
      userId,
      cleanedName,
      query.nameType,
    );

    fs.unlink(audioFile.path, (err) => {
      console.error('could not unlink file');
    });

    return { fullname };
  }

  @Post('fullname')
  @ApiOkResponse({
    description: 'The name has been successfully saved',
    type: SaveFullameDto,
  })
  async saveFullname(@Req() req: Request, @Body() fullname: SaveFullameDto) {
    const userId = req.user['id'];
    const newFullname = this.onboardingService.saveFullname(userId, fullname);
    return { newFullname };
  }
}
