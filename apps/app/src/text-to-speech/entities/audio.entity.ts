/**
 * Text-to-Speech Audio Entity
 * Represents generated speech from text
 */
import { Types } from 'mongoose';

export class AudioEntity {
  id: string;
  // reference to User._id
  userId?: Types.ObjectId | string;
  text: string;
  audioBuffer: Buffer;
  voice?: string;
  provider: string;
  duration?: number;
  language?: string;
  speed?: number;
  createdAt: Date;
  updatedAt: Date;
}
