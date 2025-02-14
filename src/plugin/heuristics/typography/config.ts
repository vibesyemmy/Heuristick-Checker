/**
 * Default typography configuration
 */

import { TypographyConfig, TextRoleConfig } from './types';

export const defaultTypographyConfig: TypographyConfig = {
  breakpoints: {
    xs: { max: 639 },
    sm: { min: 640, max: 767 },
    md: { min: 768, max: 1023 },
    lg: { min: 1024, max: 1279 },
    xl: { min: 1280, max: 1535 },
    xxl: { min: 1536 }
  },
  fontFamilies: {
    primary: ['Inter', 'SF Pro Display'],
    secondary: ['SF Pro Text', 'Roboto'],
    allowed: ['Inter', 'SF Pro Display', 'SF Pro Text', 'Roboto']
  },
  styles: {
    'heading1': {
      fontSize: {
        xs: { min: 24, max: 32 },
        sm: { min: 28, max: 36 },
        md: { min: 32, max: 40 },
        lg: { min: 36, max: 48 },
        xl: { min: 40, max: 56 },
        xxl: { min: 48, max: 64 }
      },
      lineHeight: { min: 1.2, max: 1.4 },
      letterSpacing: { min: -0.5, max: 0 },

    },
    'heading2': {
      fontSize: {
        xs: { min: 20, max: 28 },
        sm: { min: 24, max: 32 },
        md: { min: 28, max: 36 },
        lg: { min: 32, max: 40 },
        xl: { min: 36, max: 48 },
        xxl: { min: 40, max: 56 }
      },
      lineHeight: { min: 1.2, max: 1.4 },
      letterSpacing: { min: -0.3, max: 0 },

    },
    'heading3': {
      fontSize: {
        xs: { min: 18, max: 24 },
        sm: { min: 20, max: 28 },
        md: { min: 24, max: 32 },
        lg: { min: 28, max: 36 },
        xl: { min: 32, max: 40 },
        xxl: { min: 36, max: 48 }
      },
      lineHeight: { min: 1.2, max: 1.4 },
      letterSpacing: { min: -0.2, max: 0 },

    },
    'body': {
      fontSize: {
        xs: { min: 14, max: 16 },
        sm: { min: 14, max: 16 },
        md: { min: 16, max: 18 },
        lg: { min: 16, max: 18 },
        xl: { min: 16, max: 20 },
        xxl: { min: 18, max: 22 }
      },
      lineHeight: { min: 1.4, max: 1.6 },
      letterSpacing: { min: -0.1, max: 0.1 },

    },
    'button': {
      fontSize: {
        xs: { min: 14, max: 16 },
        sm: { min: 14, max: 16 },
        md: { min: 14, max: 16 },
        lg: { min: 14, max: 16 },
        xl: { min: 16, max: 18 },
        xxl: { min: 16, max: 18 }
      },
      lineHeight: { min: 1.2, max: 1.4 },
      letterSpacing: { min: 0, max: 0.1 },

    },
    'caption': {
      fontSize: {
        xs: { min: 12, max: 12 },
        sm: { min: 12, max: 12 },
        md: { min: 12, max: 14 },
        lg: { min: 12, max: 14 },
        xl: { min: 12, max: 14 },
        xxl: { min: 14, max: 16 }
      },
      lineHeight: { min: 1.4, max: 1.6 },
      letterSpacing: { min: 0, max: 0.1 },

    }
  },
  contextRules: {
    heading1: {
      preferredStyle: 'heading1',
      allowedStyles: ['heading1']
    },
    heading2: {
      preferredStyle: 'heading2',
      allowedStyles: ['heading2']
    },
    heading3: {
      preferredStyle: 'heading3',
      allowedStyles: ['heading3']
    },
    body: {
      preferredStyle: 'body',
      allowedStyles: ['body', 'caption'],

    },
    button: {
      preferredStyle: 'button',
      allowedStyles: ['button'],

    },
    label: {
      preferredStyle: 'caption',
      allowedStyles: ['caption', 'body']
    },
    link: {
      preferredStyle: 'body',
      allowedStyles: ['body', 'caption'],
    },
    list: {
      preferredStyle: 'body',
      allowedStyles: ['body', 'caption']
    },
    navigation: {
      preferredStyle: 'body',
      allowedStyles: ['body', 'button']
    }
  }
};

export const defaultTextRoleConfig: TextRoleConfig = {
  headingPatterns: [
    /^h[1-6]$/i,
    /^heading/i,
    /^title/i,
    /^section.*header/i
  ],
  buttonPatterns: [
    /^btn/i,
    /^button/i,
    /^cta/i,
    /submit|cancel|save|delete|update/i
  ],
  labelPatterns: [
    /^label/i,
    /^field.*label/i,
    /^form.*label/i
  ],
  linkPatterns: [
    /^link/i,
    /^anchor/i,
    /learn more|read more|view more|see more/i
  ],
  listPatterns: [
    /^list/i,
    /^menu/i,
    /^items?$/i
  ],
  navigationPatterns: [
    /^nav/i,
    /^menu/i,
    /^sidebar/i,
    /^topbar/i
  ],
  styleSignals: {
    heading1: {
      fontSize: { min: 32, max: 48 },
      position: {
        isTopLevel: true
      }
    },
    heading2: {
      fontSize: { min: 24, max: 31 },
      position: {
        isTopLevel: true
      }
    },
    heading3: {
      fontSize: { min: 20, max: 23 },
      position: {
        isTopLevel: true
      }
    },
    body: {
      fontSize: { min: 14, max: 16 },
      fontWeight: ['Regular', 'Medium']
    },
    button: {
      fontSize: { min: 14, max: 16 },
      fontWeight: ['Medium', 'Semi Bold']
    },
    label: {
      fontSize: { min: 12, max: 14 },
      fontWeight: ['Regular'],
      position: {
        isNearInput: true
      }
    },
    link: {
      fontSize: { min: 14, max: 16 },
      fontWeight: ['Regular', 'Medium']
    },
    list: {
      fontSize: { min: 14, max: 16 },
      fontWeight: ['Regular', 'Medium']
    },
    navigation: {
      fontSize: { min: 14, max: 16 },
      fontWeight: ['Regular', 'Medium'],
      position: {
        isInNavigation: true
      }
    }
  }
};
