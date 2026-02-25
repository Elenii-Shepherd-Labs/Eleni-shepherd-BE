import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VisionController } from './vision.controller';
import { VisionService } from './vision.service';

@Module({
  imports: [ConfigModule],
  controllers: [VisionController],
  providers: [VisionService],
  exports: [VisionService],
})
export class VisionModule {}
