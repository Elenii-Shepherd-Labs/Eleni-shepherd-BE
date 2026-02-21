// transcription.service.ts
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import fs from 'fs';

@Injectable()
export class TranscriptionService {
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async transcribeFromFile(filePath: string): Promise<string> {
    const response = await this.openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'gpt-4o-transcribe',
    });

    return response.text;
  }
}
