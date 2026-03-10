export const obstacleTypes = [
  'person',
  'vehicle',
  'bicycle',
  'pothole',
  'construction_barrier',
  'fallen_tree',
  'debris',
  'animal',
  'traffic_cone',
  'bollard',
  'curb',
  'stairs',
  'wall',
  'pole',
  'fire_hydrant',
] as const;

export type ObstacleType = (typeof obstacleTypes)[number];

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  requestId: string;
  status: string;
  processingTimeMs: number;
  imageInfo: {
    width: number;
    height: number;
    mimeType: string;
  };
  obstacles: Array<{
    id: string;
    type: string;
    confidence: number;
    boundingBox: BoundingBox;
    estimatedDistance: number | null;
    severity: string;
  }>;
}
