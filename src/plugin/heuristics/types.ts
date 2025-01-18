export type Severity = 'high' | 'medium' | 'low';

export interface HeuristicResult {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  severity: Severity;
  recommendations?: string[];
  nodeId: string;
  nodeName: string;
  
  // Color contrast specific fields
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
  
  // Icon contrast specific fields
  role?: 'interactive' | 'informative' | 'decorative';
  colors?: {
    original: string;
    blended: string;
    coverage: number;
    contrastRatio: number;
  }[];
  failingColors?: string[];
  isCompliant?: boolean;
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
