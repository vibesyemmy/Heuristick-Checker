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
  minScore: 5, // Minimum score to be considered a button
  namingPatterns: [
    'button',
    'btn',
    'cta',
    'action',
    'submit',
    'toggle',
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
    'register',
    'get started',
    'learn more',
  ],
  dimensionRanges: {
    minHeight: 24,
    maxHeight: 60,
    minWidth: 60,
    maxWidth: 300,
  },
  commonRadii: [0, 4, 8, 12, 16, 20, 24, 32, 9999], // 9999 for fully rounded
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
