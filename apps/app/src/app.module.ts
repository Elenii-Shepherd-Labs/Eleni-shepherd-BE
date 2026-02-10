import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@app/common/database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configuration } from '@app/common/configuration';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { AuthModule } from './auth/auth.module';
import { ConversationalAiModule } from './conversational-ai/conversational-ai.module';
import { SpeechToTextModule } from './speech-to-text/speech-to-text.module';
import { TextToSpeechModule } from './text-to-speech/text-to-speech.module';
import { LlmModule } from './llm/llm.module';
import { AudioProcessingModule } from './audio-processing/audio-processing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', load: [configuration] }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        store: redisStore,
        host: config.get('redis.host') || '127.0.0.1',
        port: config.get('redis.port') || 6379,
        ttl: config.get('cache.ttl') || 0,
      }),
    }),
    DatabaseModule,
    AuthModule,
    ConversationalAiModule,
    SpeechToTextModule,
    TextToSpeechModule,
    LlmModule,
    AudioProcessingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
