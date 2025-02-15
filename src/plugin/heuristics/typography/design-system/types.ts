/**
 * Types for design system detection and handling
 */

export interface DesignSystemSource {
  type: 'local' | 'external';
  fileKey?: string;
  location: {
    page?: string;
    frame?: string;
    lastUpdated?: string;
  };
  status: 'active' | 'draft' | 'deprecated';
}

export interface TypographyToken {
  role: string;
  breakpoints: {
    [breakpoint: string]: {
      fontSize: { min: number; max: number };
      lineHeight: { min: number; max: number };
      letterSpacing?: number;
      fontWeight?: string[];
    };
  };
  variants?: {
    [variant: string]: Partial<TypographyToken>;
  };
}

export interface DesignSystemTokens {
  typography: {
    [tokenName: string]: TypographyToken;
  };
  breakpoints: {
    [name: string]: { min?: number; max?: number };
  };
}

export interface DesignSystemInfo {
  source: DesignSystemSource;
  tokens: DesignSystemTokens;
  confidence: number;
  metadata: {
    name?: string;
    version?: string;
    description?: string;
    lastUpdated: string;
  };
}
