/**
 * Shared utilities and types for typography validation
 */

import { TextRole, StyleOverride } from './types';

export interface TextNodeWithStyle extends TextNode {
  // Additional properties that might be needed for style analysis
  textStyleId: string;
  fontSize: number;
  fontName: FontName;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  textCase: TextCase;
  textDecoration: TextDecoration;
  textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical: 'TOP' | 'CENTER' | 'BOTTOM';
  paragraphIndent: number;
  paragraphSpacing: number;
}

export type StyledTextSegmentFields = 
  | 'characters'
  | 'textStyleId'
  | 'fontName'
  | 'fontSize'
  | 'lineHeight'
  | 'letterSpacing'
  | 'textCase'
  | 'textDecoration'
  | 'fills';

/**
 * Normalizes a line height value to a number
 */
export interface NormalizedLineHeight {
  value: number;  // The actual line height value
  unit: 'PIXELS' | 'RATIO';  // Whether it's in pixels or a ratio
}

export function normalizeLineHeight(lineHeight: LineHeight, fontSize?: number): NormalizedLineHeight {
  switch (lineHeight.unit) {
    case 'PIXELS':
      return {
        value: lineHeight.value,
        unit: 'PIXELS'
      };
    case 'PERCENT':
      if (fontSize) {
        return {
          value: (lineHeight.value / 100) * fontSize,
          unit: 'PIXELS'
        };
      }
      return {
        value: lineHeight.value / 100,
        unit: 'RATIO'
      };
    case 'AUTO':
      return {
        value: 1.2,
        unit: 'RATIO'
      };
    default:
      return {
        value: 1.2,
        unit: 'RATIO'
      };
  }
}

/**
 * Normalizes letter spacing to pixels
 */
export function normalizeLetterSpacing(letterSpacing: LetterSpacing): number {
  switch (letterSpacing.unit) {
    case 'PIXELS':
      return letterSpacing.value;
    case 'PERCENT':
      return letterSpacing.value / 100;
    default:
      return 0;
  }
}

/**
 * Checks if a value is mixed (Figma's mixed property)
 */
export function isMixed(value: any): value is typeof figma.mixed {
  return value === figma.mixed;
}

/**
 * Type guard for FontName
 */
export function isFontName(value: any): value is FontName {
  return value && typeof value === 'object' && 
         'family' in value && 'style' in value &&
         typeof value.family === 'string' && 
         typeof value.style === 'string';
}

/**
 * Gets all text styles from a text node
 */
export function getTextStyles(node: TextNodeWithStyle): StyleOverride[] {
  const overrides: StyleOverride[] = [];
  
  // Check if any property is mixed
  if (isMixed(node.fontName)) {
    overrides.push({
      property: 'fontFamily',
      expected: null,
      actual: 'mixed',
    });
  }
  
  if (isMixed(node.fontSize)) {
    overrides.push({
      property: 'fontSize',
      expected: null,
      actual: 'mixed',
    });
  }
  
  return overrides;
}

/**
 * Extracts role from component or frame name
 */
export function extractRoleFromName(name: string): TextRole | null {
  const lowerName = name.toLowerCase();
  
  // Check for specific heading levels
  if (lowerName.match(/heading[123]/)) {
    const level = lowerName.match(/heading([123])/)?.[1];
    return `heading${level}` as TextRole;
  }
  // Default to heading1 for generic headings and titles
  if (lowerName.includes('heading') || lowerName.includes('title')) return 'heading1';
  if (lowerName.includes('button') || lowerName.includes('cta')) return 'button';
  if (lowerName.includes('label')) return 'label';
  if (lowerName.includes('link')) return 'link';
  if (lowerName.includes('list')) return 'list';
  if (lowerName.includes('nav')) return 'navigation';
  
  return null;
}
