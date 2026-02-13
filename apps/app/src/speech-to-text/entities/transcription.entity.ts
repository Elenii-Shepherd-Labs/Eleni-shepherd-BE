/**
 * Speech-to-Text Transcription Entity
 * Represents an audio file and its transcription
 */
export class TranscriptionEntity {
  id: string;
  userId?: string;
  audioFilePath: string;
  audioFileName: string;
  text: string;
  language?: string;
  provider: string;
  isFinal: boolean;
  duration?: number;
  confidence?: number;
  createdAt: Date;
  updatedAt: Date;
}
