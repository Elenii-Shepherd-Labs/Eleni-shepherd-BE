import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpeechToTextModule } from '../speech-to-text/speech-to-text.module';
import { TextToSpeechModule } from '../text-to-speech/text-to-speech.module';
import { AudioProcessingService } from './audio-processing.service';

@Module({
  imports: [
    ConfigModule,
    SpeechToTextModule,
    TextToSpeechModule,
  ],
  providers: [AudioProcessingService],
  exports: [AudioProcessingService],
})
export class AudioProcessingModule {}
