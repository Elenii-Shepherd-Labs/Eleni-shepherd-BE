import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';

@Module({
  imports: [ConfigModule],
  controllers: [BlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
