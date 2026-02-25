import { Module } from '@nestjs/common';
import { TextToSpeechModule } from '../text-to-speech/text-to-speech.module';
import { VisionModule } from '../vision/vision.module';
import { AccessibilityController } from './accessibility.controller';

@Module({
  imports: [TextToSpeechModule, VisionModule],
  controllers: [AccessibilityController],
})
export class AccessibilityModule {}
