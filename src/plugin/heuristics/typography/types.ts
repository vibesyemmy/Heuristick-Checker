/**
 * Typography validation types and interfaces
 */

export type HeadingRole = 'heading1' | 'heading2' | 'heading3';
export type TextRole = HeadingRole | 'body' | 'button' | 'label' | 'link' | 'list' | 'navigation';
export interface Breakpoint {
  min?: number;
  max?: number;
}

export interface FontSizeRange {
  min: number;
  max: number;
}

export interface TextStyleConfig {
  fontSize: {
    [breakpoint: string]: FontSizeRange;
  };
  lineHeight: {
    min: number;
    max: number;
  };
  letterSpacing?: {
    min: number;
    max: number;
  };
  fontWeight?: string[];
  fontFamily?: string[];
}

export interface TypographyConfig {
  breakpoints: {
    [key: string]: Breakpoint;
  };
  fontFamilies: {
    primary: string[];
    secondary: string[];
    allowed: string[];  // All allowed fonts including primary/secondary
  };
  styles: {
    [key: string]: TextStyleConfig & {
        };
  };
  contextRules: {
    [key in TextRole]?: {
      preferredStyle: string;  // References a style key
      allowedStyles: string[];
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
}

export interface RichTextAnalysis {
  segments: {
    text: string;
    style: {
      fontFamily: string;
      fontSize: number;
      fontWeight: string;
      lineHeight?: number;
      letterSpacing?: number;
    };
    start: number;
    end: number;
  }[];
  hasMultipleFonts: boolean;
  hasMultipleSizes: boolean;
  hasMultipleWeights: boolean;
  styleOverrides: StyleOverride[];
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
