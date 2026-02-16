/**
 * Speech-to-Text Transcription Entity
 * Represents an audio file and its transcription
 */
import { Types } from 'mongoose';

export class TranscriptionEntity {
  id: string;
  // reference to User._id
  userId?: Types.ObjectId | string;
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
