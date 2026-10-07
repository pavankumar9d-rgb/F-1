export interface TierInfo {
  folder: string;
  w: number;
  h: number;
}

export interface EngineConfig {
  count: number;
  pad: number;
  ext: string;
  fps: number;
  tiers: {
    [key: string]: TierInfo;
  };
}

export type QualityTier = '2k' | '1080' | '720';

export interface CarChassis {
  id: string;
  name: string;
  livery: string;
  category: 'Hybrid V6' | 'V8 Classic' | 'Simulator Included';
  hp: string;
  acceleration: string;
  topSpeed: string;
  specSummary: string;
  priceEur: number;
  image: string;
}

export interface TelemetryState {
  frameIndex: number;
  targetIndex: number;
  speedKmh: number;
  timecode: string;
  chapter: string;
  chapterIndex: number;
  progress: number;
  activeTier: QualityTier;
  fps: number;
  avgDrawMs: number;
}
