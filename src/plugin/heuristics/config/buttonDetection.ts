export interface ButtonDetectionConfig {
  minScore: number;
  namingPatterns: string[];
  commonActionWords: string[];
  dimensionRanges: {
    minHeight: number;
    maxHeight: number;
    minWidth: number;
    maxWidth: number;
  };
  commonRadii: number[];
}

export const defaultButtonConfig: ButtonDetectionConfig = {
  minScore: 12, // Increased significantly to prevent false positives
  namingPatterns: [
    '^button[\\s/]',  // Must start with "button" followed by space or slash
    '^btn[\\s/]',     // Must start with "btn" followed by space or slash
    '/button$',       // Must end with "button" preceded by slash (component path)
    '^cta[\\s/]',     // Must start with "cta" followed by space or slash
    'submit$'         // Must end with "submit"
  ],
  commonActionWords: [
    'submit',
    'send',
    'next',
    'previous',
    'back',
    'continue',
    'save',
    'cancel',
    'delete',
    'edit',
    'create',
    'add',
    'remove',
    'update',
    'sign in',
    'sign up',
    'login',
    'logout',
    'register'
  ],
  dimensionRanges: {
    minHeight: 32,
    maxHeight: 56,
    minWidth: 80,
    maxWidth: 280
  },
  commonRadii: [4, 6, 8, 12, 16, 20, 24, 28, 32]
};

// Debug levels for button detection
export enum ButtonDetectionDebugLevel {
  NONE = 0,
  BASIC = 1,
  DETAILED = 2,
}

export interface ButtonDetectionResult {
  isButton: boolean;
  score: number;
  reasons: string[];
  debugInfo?: {
    namingScore: number;
    structureScore: number;
    dimensionScore: number;
    styleScore: number;
    actionWordsScore: number;
  };
}
