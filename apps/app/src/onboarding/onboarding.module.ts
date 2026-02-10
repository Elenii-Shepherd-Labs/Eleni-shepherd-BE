import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { TranscriptionService } from './transcription.service';
import { OnboardingService } from './onboarding.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [OnboardingController],
  providers: [TranscriptionService, OnboardingService],
})
export class OnboardingModule {}
