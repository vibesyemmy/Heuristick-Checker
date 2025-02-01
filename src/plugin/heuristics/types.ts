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

// Icon role type
export type IconRole = 'interactive' | 'informative' | 'decorative';

// Color analysis type
export interface ColorAnalysisResult {
  original: FigmaColor;
  blended: FigmaColor;
  fillOpacity: number;
  layerOpacity: number;
  contrastRatio: number;
}

// Icon contrast specific fields
export interface IconContrastHeuristicResult extends HeuristicResult {
  type: 'icon_contrast';
  category: 'Accessibility';
  role: IconRole;
  colors: ColorAnalysisResult[];
  backgroundColor: FigmaColor;
  contrastRatio: number;
  requiredRatio: number;
  failingColors: FigmaColor[];
  isCompliant: boolean;
}

// Icon contrast result
export interface IconContrastResult {
  passed: boolean;
  description: string;
  severity: 'high' | 'medium' | 'low';
  role: IconRole;
  colors: ColorAnalysisResult[];
  backgroundColor: FigmaColor;
  contrastRatio: number;
  requiredRatio: number;
  nodeId: string;
  nodeName: string;
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
