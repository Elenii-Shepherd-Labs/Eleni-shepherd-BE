import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpeechToTextService } from './speech-to-text.service';
import { SpeechToTextController } from './speech-to-text.controller';

@Module({
  imports: [ConfigModule],
  providers: [SpeechToTextService],
  controllers: [SpeechToTextController],
  exports: [SpeechToTextService],
})
export class SpeechToTextModule {}
