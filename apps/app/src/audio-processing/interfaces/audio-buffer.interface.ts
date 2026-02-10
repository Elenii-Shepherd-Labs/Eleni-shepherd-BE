export interface AudioBuffer {
  sessionId: string;
  chunks: Buffer[];
  totalBytes: number;
  lastChunkTime: Date;
}

export interface AudioProcessingResult {
  transcript?: string;
  isFinal: boolean;
  duration?: number;
  confidence?: number;
}
