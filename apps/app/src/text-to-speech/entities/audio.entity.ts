/**
 * Text-to-Speech Audio Entity
 * Represents generated speech from text
 */
export class AudioEntity {
  id: string;
  userId?: string;
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
