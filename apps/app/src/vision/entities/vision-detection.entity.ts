/**
 * Vision/Object Detection Entity - YOLO detection result
 */
export class VisionDetectionEntity {
  label: string;
  confidence: number;
  bbox?: { x: number; y: number; w: number; h: number };
}

export class VisionResponseEntity {
  detections: VisionDetectionEntity[];
  raw?: any;
}
