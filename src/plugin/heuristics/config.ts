import { IconDetectionConfig } from './types';

export const defaultConfig: IconDetectionConfig = {
  minIconSize: 12,
  maxIconSize: 64,
  maxAspectRatio: 2,
  namePatterns: [
    /icon/i,
    /ico$/i,
    /^i-/i,
    /^icon-/i,
    /\bicon\b/i
  ],
  shapeTypes: [
    'VECTOR',
    'STAR',
    'ELLIPSE',
    'POLYGON',
    'BOOLEAN_OPERATION'
  ],
  contrastThresholds: {
    interactive: 3.0,
    informative: 3.0,
    decorative: 2.0
  },
  scoreThresholds: {
    minimum: 0.5,
    good: 0.7,
    excellent: 0.9
  }
};
