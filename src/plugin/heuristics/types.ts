export type Severity = 'high' | 'medium' | 'low';

export interface Heuristic {
  id: string;
  name: string;
  description: string;
  check: (node: SceneNode) => Promise<HeuristicResult[]>;
}

export interface HeuristicResult {
  id: string;
  nodeId: string;
  nodeName: string;
  type: string;
  category: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  recommendations: string[];
}

// Figma color type
export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

// Color contrast specific fields
export interface ColorContrastHeuristicResult extends HeuristicResult {
  textColor?: string;
  backgroundColor?: string;
  contrastRatio?: number;
  requiredRatio?: number;
  hasMixedWeights?: boolean;
  fontWeightSegments?: {
    text: string;
    weight: number;
    fontSize: number;
    position?: {
      start: number;
      end: number;
    };
  }[];
  lowestWeight?: number;
  highestWeight?: number;
}

// Icon contrast specific fields
export interface IconContrastHeuristicResult extends HeuristicResult {
  type: 'icon_contrast';
  category: 'Accessibility';
  role: 'interactive' | 'informative' | 'decorative';
  colors: {
    original: FigmaColor;
    blended: FigmaColor;
    effectiveOpacity: number;
    contrastRatio: number;
  }[];
  backgroundColor: FigmaColor;
  contrastRatio: number;
  requiredRatio: number;
  failingColors: FigmaColor[];
  isCompliant: boolean;
}

// Configuration for icon detection
export interface IconDetectionConfig {
  minIconSize: number;
  maxIconSize: number;
  maxAspectRatio: number;
  namePatterns: RegExp[];
  shapeTypes: string[];
  contrastThresholds: {
    interactive: number;
    informative: number;
    decorative: number;
  };
  scoreThresholds: {
    minimum: number;
    good: number;
    excellent: number;
  };
}

// Type for a heuristic check function
export type HeuristicCheck = (node: SceneNode) => Promise<HeuristicResult | HeuristicResult[] | null>;

export interface HeuristicDefinition {
  id: string;
  name: string;
  description: string;
  check: HeuristicCheck;
  category: string;
}
