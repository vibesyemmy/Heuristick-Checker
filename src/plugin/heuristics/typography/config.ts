/**
 * Default typography configuration
 */

import { TypographyConfig, TextRoleConfig, TypeScale } from './types';

// Major third scale (1.25) with progressive enhancement
const generateTypeScale = (base: number, multiplier: number = 1): TypeScale => {
  const scale = 1.25;  // Major third scale
  return {
    small: Math.round(base * multiplier),
    base: Math.round(base * scale * multiplier),
    h3: Math.round(base * scale * scale * multiplier),
    h2: Math.round(base * scale * scale * scale * multiplier),
    h1: Math.round(base * scale * scale * scale * scale * multiplier)
  };
};

export const defaultTypographyConfig: TypographyConfig = {
  responsive: {
    breakpoints: {
      xs: { maxWidth: 320, baseSize: 14 },
      sm: { minWidth: 321, maxWidth: 768, baseSize: 15 },
      md: { minWidth: 769, maxWidth: 1024, baseSize: 16 },
      lg: { minWidth: 1025, maxWidth: 1440, baseSize: 16 },
      xl: { minWidth: 1441, baseSize: 18 }
    },
    multipliers: {
      xs: 1,
      sm: 1.125,
      md: 1.25,
      lg: 1.333,
      xl: 1.5
    },
    scales: {
      // Dynamic scales based on breakpoint base sizes
      xs: generateTypeScale(14),      // Mobile portrait
      sm: generateTypeScale(15, 1.125), // Mobile landscape
      md: generateTypeScale(16, 1.25),  // Tablet
      lg: generateTypeScale(16, 1.333), // Desktop
      xl: generateTypeScale(18, 1.5),   // Large screens

      // Component-specific scales
      heading1: {
        small: [24, 32],
        medium: [32, 40],
        large: [40, 48]
      },
      heading2: {
        small: [20, 24],
        medium: [24, 32],
        large: [32, 40]
      },
      heading3: {
        small: [16, 20],
        medium: [20, 24],
        large: [24, 32]
      },
      body: {
        small: [14, 16],
        medium: [14, 16],
        large: [16, 18]
      },
      button: {
        small: [14, 16],
        medium: [14, 16],
        large: [14, 16]
      },
      caption: {
        small: [12],
        medium: [12, 14],
        large: [14]
      }
    }
  },
  fontFamilies: {
    primary: ['Inter', 'SF Pro Display'],
    secondary: ['SF Pro Text', 'Roboto'],
    allowed: ['Inter', 'SF Pro Display', 'SF Pro Text', 'Roboto']
  },
  styles: {
    'heading1': {
      fontSize: [32, 40, 48],
      fontWeight: ['Semi Bold', 'Bold'],
      lineHeight: { min: 1.2, max: 1.4 },
      letterSpacing: { min: -0.2, max: 0 },
      alignment: ['LEFT', 'CENTER']
    },
    'heading2': {
      fontSize: [24, 28, 32],
      fontWeight: ['Semi Bold', 'Bold'],
      lineHeight: { min: 1.2, max: 1.4 },
      letterSpacing: { min: -0.1, max: 0 },
      alignment: ['LEFT', 'CENTER']
    },
    'heading3': {
      fontSize: [20, 24],
      fontWeight: ['Semi Bold', 'Medium'],
      lineHeight: { min: 1.2, max: 1.4 },
      letterSpacing: { min: -0.1, max: 0 },
      alignment: ['LEFT', 'CENTER']
    },
    'body': {
      fontSize: [14, 16],
      fontWeight: ['Regular', 'Medium'],
      lineHeight: { min: 1.5, max: 1.8 },
      letterSpacing: { min: -0.1, max: 0.1 },
      alignment: ['LEFT', 'JUSTIFIED']
    },
    'button': {
      fontSize: [14, 16],  // Allow 14-16px for buttons
      fontWeight: ['Medium', 'Semi Bold'],
      lineHeight: { min: 1.2, max: 1.4 },
      letterSpacing: { min: 0, max: 0.1 },
      alignment: ['CENTER']
    },
    'caption': {
      fontSize: [12],
      fontWeight: ['Regular'],
      lineHeight: { min: 1.4, max: 1.6 },
      letterSpacing: { min: 0, max: 0.1 },
      alignment: ['LEFT']
    }
  },
  contextRules: {
    heading: {
      preferredStyle: 'heading1',
      allowedStyles: ['heading1', 'heading2', 'heading3'],
      requiredAlignment: ['LEFT', 'CENTER']
    },
    body: {
      preferredStyle: 'body',
      allowedStyles: ['body', 'caption'],
      requiredAlignment: ['LEFT', 'JUSTIFIED']
    },
    button: {
      preferredStyle: 'button',
      allowedStyles: ['button'],
      requiredAlignment: ['CENTER']
    },
    label: {
      preferredStyle: 'caption',
      allowedStyles: ['caption', 'body'],
      requiredAlignment: ['LEFT']
    },
    link: {
      preferredStyle: 'body',
      allowedStyles: ['body', 'caption'],
    },
    list: {
      preferredStyle: 'body',
      allowedStyles: ['body', 'caption'],
      requiredAlignment: ['LEFT']
    },
    navigation: {
      preferredStyle: 'body',
      allowedStyles: ['body', 'button'],
      requiredAlignment: ['LEFT', 'CENTER']
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
    heading: {
      fontSize: { min: 20, max: 48 },
      fontWeight: ['Semi Bold', 'Bold'],
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
