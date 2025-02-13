/**
 * Typography validation types and interfaces
 */

export type TextRole = 'heading' | 'body' | 'button' | 'label' | 'link' | 'list' | 'navigation';
export type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export type TextAlignment = 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';

export interface Breakpoint {
  minWidth?: number;
  maxWidth?: number;
  baseSize: number;
}

export interface TypeScale {
  small: number;
  base: number;
  h3: number;
  h2: number;
  h1: number;
}

export interface ComponentScale {
  small: number[];
  medium: number[];
  large: number[];
}

export interface ResponsiveScale {
  breakpoints: Record<BreakpointKey, Breakpoint>;
  multipliers: Record<BreakpointKey, number>;
  scales: {
    [K in BreakpointKey]: TypeScale;
  } & {
    [key: string]: ComponentScale | TypeScale;
  };
}

export interface TypographyConfig {
  responsive: ResponsiveScale;
  fontFamilies: {
    primary: string[];
    secondary: string[];
    allowed: string[];  // All allowed fonts including primary/secondary
  };
  styles: {
    [key: string]: {  // e.g., 'heading1', 'body', 'button'
      fontSize: number[];
      fontWeight: string[];
      lineHeight: { min: number; max: number };
      letterSpacing: { min: number; max: number };
      alignment?: TextAlignment[];
    };
  };
  contextRules: {
    [key in TextRole]?: {
      preferredStyle: string;  // References a style key
      allowedStyles: string[];
      requiredAlignment?: TextAlignment[];
    };
  };
}

export interface TextContext {
  role: TextRole;
  level?: number;  // For headings (h1, h2, etc.)
  parentComponent?: string;  // The parent component type
  confidence: number;  // How confident we are about the role
  alternativeRoles?: TextRole[];  // Other possible roles if ambiguous
  hasAmbiguity?: boolean;  // True if there are competing signals
  frameWidth: number;
  breakpointKey: BreakpointKey;
  sizeCategory: 'small' | 'medium' | 'large';
}

export interface StyleOverride {
  property: 'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing';
  expected: any;
  actual: any;
  range?: { start: number; end: number };  // Character range where override occurs
}

export interface TypographyIssue {
  type: 'Invalid Font' | 'Invalid Font Size' | 'Invalid Font Weight' | 
        'Invalid Line Height' | 'Invalid Letter Spacing' | 'Invalid Alignment' |
        'Mixed Styles' | 'Context Mismatch';
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;  // Unique identifier for the issue type
  node: TextNode;
  range?: { start: number; end: number };  // Character range where issue occurs
  expected?: any;
  actual?: any;
  suggestion?: string;
}

export interface ValidationResult {
  issues: TypographyIssue[];
  context: TextContext;
  confidence: number;
  suggestions: string[];
  node: TextNode;
  styleOverrides?: StyleOverride[];
  richTextAnalysis?: RichTextAnalysis;
}



export interface RichTextAnalysis {
  segments: {
    text: string;
    style: {
      fontFamily: string | 'mixed';
      fontSize: number;
      fontWeight: string | 'mixed';
      lineHeight?: number;
      letterSpacing?: number;
    };
    start: number;
    end: number;
  }[];
  characters: string;
  style: {
    fontFamily: string | 'mixed';
    fontSize: number;
    fontWeight: string | 'mixed';
    lineHeight?: number;
    letterSpacing?: number;
  };
  hasMultipleFonts: boolean;
  hasMultipleSizes: boolean;
  hasMultipleWeights: boolean;
  styleOverrides: StyleOverride[];
  issues: TypographyIssue[];
  start: number;
  end: number;
}

// Configuration for text role detection
export interface TextRoleConfig {
  headingPatterns: RegExp[];
  buttonPatterns: RegExp[];
  labelPatterns: RegExp[];
  linkPatterns: RegExp[];
  listPatterns: RegExp[];
  navigationPatterns: RegExp[];
  styleSignals: {
    [key in TextRole]: {
      fontSize?: { min: number; max: number };
      fontWeight?: string[];
      position?: {
        isTopLevel?: boolean;
        isNearInput?: boolean;
        isInNavigation?: boolean;
      };
    };
  };
}
