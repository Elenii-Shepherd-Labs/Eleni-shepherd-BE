/**
 * Audio Processing Buffer Entity
 * Represents audio data and processing metadata
 */
export class AudioProcessingEntity {
  id: string;
  userId?: string;
  sourceAudioPath: string;
  processedAudioBuffer: Buffer;
  format: string;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  duration: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}
