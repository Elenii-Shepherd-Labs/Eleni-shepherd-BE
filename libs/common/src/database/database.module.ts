import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async (configService: ConfigService) => {
        const primary = configService.get<string>('app.database');
        const fallback = configService.get<string>('app.databaseFallback');
        // Choose fallback if provided (useful for non-SRV / standard connection strings)
        const chosen = fallback && fallback.length > 0 ? fallback : primary;
        // Mask credentials for safe logging
        const masked = chosen
          ? chosen.replace(/(mongodb(\+srv)?:\/\/)(.*@)/, '$1****@')
          : chosen;
        console.log(`MongoDB connecting to: ${masked}`);
        return { uri: chosen };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
