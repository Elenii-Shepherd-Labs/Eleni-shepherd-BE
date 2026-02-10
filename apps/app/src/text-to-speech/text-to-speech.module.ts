import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TextToSpeechService } from './text-to-speech.service';
import { TextToSpeechController } from './text-to-speech.controller';

@Module({
  imports: [ConfigModule],
  providers: [TextToSpeechService],
  controllers: [TextToSpeechController],
  exports: [TextToSpeechService],
})
export class TextToSpeechModule {}
