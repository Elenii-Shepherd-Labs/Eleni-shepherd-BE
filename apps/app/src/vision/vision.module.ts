import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VisionController } from './vision.controller';
import { VisionService } from './vision.service';
import { ObstacleDetectionService } from './obstacle-detection.service';

@Module({
  imports: [ConfigModule],
  controllers: [VisionController],
  providers: [VisionService, ObstacleDetectionService],
  exports: [VisionService],
})
export class VisionModule {}
