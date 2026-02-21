import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RadioStationsController } from './radio-stations.controller';
import { RadioStationsService } from './radio-stations.service';

@Module({
  imports: [ConfigModule],
  controllers: [RadioStationsController],
  providers: [RadioStationsService],
  exports: [RadioStationsService],
})
export class RadioStationsModule {}
