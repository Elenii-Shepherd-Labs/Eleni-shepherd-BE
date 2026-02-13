import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpeechToTextModule } from '../speech-to-text/speech-to-text.module';
import { TextToSpeechModule } from '../text-to-speech/text-to-speech.module';
import { AudioProcessingService } from './audio-processing.service';
import { AudioProcessingController } from './audio-processing.controller';

@Module({
  imports: [
    ConfigModule,
    SpeechToTextModule,
    TextToSpeechModule,
  ],
  providers: [AudioProcessingService],
  controllers: [AudioProcessingController],
  exports: [AudioProcessingService],
})
export class AudioProcessingModule {}
