import { ButtonProperties, ButtonText, TextCase, TextDecoration, Paint, Effect } from './types';

interface ButtonPattern {
  name: string;
  buttons: ButtonProperties[];
  commonProperties: {
    size?: {
      width: number | 'variable';
      height: number;
    };
    style?: {
      fills: ReadonlyArray<Paint>;
      strokes: ReadonlyArray<Paint>;
      effects: ReadonlyArray<Effect>;
      cornerRadius: number | number[] | undefined;
    };
    text?: {
      fontSize: number;
      fontWeight: number;
      textCase: TextCase;
      textDecoration: TextDecoration;
    };
  };
}

export interface PatternAnalysisResult {
  patterns: ButtonPattern[];
  inconsistencies: {
    button: ButtonProperties;
    patternName: string;
    differences: {
      property: string;
      expected: any;
      actual: any;
    }[];
  }[];
}

export interface ButtonGroup {
  buttons: ButtonProperties[];
}

export interface ButtonPatternAnalysis {
  textStyles: ButtonGroup[];
  styles: ButtonGroup[];
  sizes: ButtonGroup[];
  states: ButtonGroup[];
}

/**
 * Analyze button patterns to find inconsistencies
 */
export function analyzeButtonPatterns(buttons: ButtonProperties[]): ButtonPatternAnalysis {
  return {
    textStyles: groupButtonsByProperty(buttons, button => {
      return getTextProperties(button.text);
    }),
    styles: groupButtonsByProperty(buttons, button => ({
      fills: button.style.fills,
      strokes: button.style.strokes,
      effects: button.style.effects,
      cornerRadius: button.style.cornerRadius
    })),
    sizes: groupButtonsByProperty(buttons, button => ({
      width: button.size.width,
      height: button.size.height,
      padding: button.size.padding
    })),
    states: groupButtonsByProperty(buttons, button => ({
      hasHoverState: button.states.hasHoverState,
      hasPressedState: button.states.hasPressedState,
      hasDisabledState: button.states.hasDisabledState
    }))
  };
}

function groupButtonsByProperty<T>(
  buttons: ButtonProperties[],
  getKey: (button: ButtonProperties) => T
): ButtonGroup[] {
  const groups = new Map<string, ButtonProperties[]>();

  buttons.forEach(button => {
    const key = JSON.stringify(getKey(button));
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(button);
  });

  return Array.from(groups.values()).map(buttons => ({ buttons }));
}

function getDefaultTextProperties(): ButtonText {
  return {
    fontSize: 0,
    fontWeight: 400,
    textCase: 'ORIGINAL',
    textDecoration: 'NONE'
  };
}

function getTextProperties(text: ButtonText | undefined): ButtonText {
  const defaultProps = getDefaultTextProperties();
  if (!text) {
    return defaultProps;
  }
  return {
    fontSize: text.fontSize ?? defaultProps.fontSize,
    fontWeight: text.fontWeight ?? defaultProps.fontWeight,
    textCase: text.textCase ?? defaultProps.textCase,
    textDecoration: text.textDecoration ?? defaultProps.textDecoration
  };
import { ButtonProperties } from './types';

interface ButtonPattern {
  name: string;
  buttons: ButtonProperties[];
  commonProperties: {
    size?: {
      width: number | 'variable';
      height: number;
    };
    style?: {
      fills: ReadonlyArray<Paint>;
      strokes: ReadonlyArray<Paint>;
      effects: ReadonlyArray<Effect>;
      cornerRadius: number | number[] | undefined;
    };
    text?: {
      fontSize: number;
      fontWeight: number;
      textCase: TextCase;
      textDecoration: TextDecoration;
    };
  };
  variants: {
    sizes: Set<string>;
    states: Set<string>;
    types: Set<string>;
  };
}

export interface PatternAnalysisResult {
  patterns: ButtonPattern[];
  inconsistencies: {
    button: ButtonProperties;
    patternName: string;
    differences: {
      property: string;
      expected: any;
      actual: any;
    }[];
  }[];
}

export interface ButtonGroup {
  buttons: ButtonProperties[];
}

export interface ButtonPatternAnalysis {
  textStyles: ButtonGroup[];
  styles: ButtonGroup[];
  sizes: ButtonGroup[];
  states: ButtonGroup[];
}

/**
 * Analyze button patterns to find inconsistencies
 */
export function analyzeButtonPatterns(buttons: ButtonProperties[]): ButtonPatternAnalysis {
  return {
    textStyles: groupButtonsByProperty(buttons, button => ({
      fontSize: button.text?.fontSize ?? null,
      fontWeight: button.text?.fontWeight ?? null,
      textCase: button.text?.textCase ?? 'ORIGINAL',
      textDecoration: button.text?.textDecoration ?? 'NONE'
    })),
    styles: groupButtonsByProperty(buttons, button => ({
      fills: button.style.fills,
      strokes: button.style.strokes,
      effects: button.style.effects,
      cornerRadius: button.style.cornerRadius
    })),
    sizes: groupButtonsByProperty(buttons, button => ({
      width: button.size.width,
      height: button.size.height,
      padding: button.size.padding
    })),
    states: groupButtonsByProperty(buttons, button => ({
      hasHoverState: button.states.hasHoverState,
      hasPressedState: button.states.hasPressedState,
      hasDisabledState: button.states.hasDisabledState
    }))
  };
}

function groupButtonsByProperty<T>(
  buttons: ButtonProperties[],
  getKey: (button: ButtonProperties) => T
): ButtonGroup[] {
  const groups = new Map<string, ButtonProperties[]>();

  buttons.forEach(button => {
    const key = JSON.stringify(getKey(button));
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(button);
  });

  return Array.from(groups.values()).map(buttons => ({ buttons }));
}

/**
 * Analyze a group of buttons to find common properties
 */
function analyzeButtonGroup(name: string, buttons: ButtonProperties[]): ButtonPattern {
  const commonProperties: ButtonPattern['commonProperties'] = {
    size: findCommonSize(buttons),
    style: findCommonStyle(buttons),
    text: findCommonTextStyle(buttons)
  };

  const variants = {
    sizes: new Set<string>(),
    states: new Set<string>(),
    types: new Set<string>()
  };

  // Collect all variants
  buttons.forEach(button => {
    if (button.variants) {
      button.variants.sizes?.forEach(size => variants.sizes.add(size));
      button.variants.states?.forEach(state => variants.states.add(state));
      button.variants.types?.forEach(type => variants.types.add(type));
    }
  });

  return {
    name,
    buttons,
    commonProperties,
    variants
  };
}

/**
 * Find common size properties among buttons
 */
function findCommonSize(buttons: ButtonProperties[]): ButtonPattern['commonProperties']['size'] {
  const heights = new Set(buttons.map(b => b.size.height));
  const widths = new Set(buttons.map(b => b.size.width));

  return {
    width: widths.size === 1 ? buttons[0].size.width : 'variable',
    height: heights.size === 1 ? buttons[0].size.height : buttons[0].size.height
  };
}

/**
 * Find common style properties among buttons
 */
function findCommonStyle(buttons: ButtonProperties[]): ButtonPattern['commonProperties']['style'] {
  const firstButton = buttons[0];
  return {
    fills: firstButton.style.fills,
    strokes: firstButton.style.strokes,
    effects: firstButton.style.effects,
    cornerRadius: firstButton.style.cornerRadius
  };
}

/**
 * Find common text style properties among buttons
 */
function findCommonTextStyle(buttons: ButtonProperties[]): ButtonPattern['commonProperties']['text'] | undefined {
  const buttonsWithText = buttons.filter(b => b.text);
  if (buttonsWithText.length === 0) return undefined;

  const firstButton = buttonsWithText[0];
  return {
    fontSize: firstButton.text!.fontSize,
    fontWeight: firstButton.text!.fontWeight,
    textCase: firstButton.text!.textCase,
    textDecoration: firstButton.text!.textDecoration
  };
}

/**
 * Find differences between a button and common properties
 */
function findButtonDifferences(
  button: ButtonProperties,
  commonProps: ButtonPattern['commonProperties']
): { property: string; expected: any; actual: any; }[] {
  const differences: { property: string; expected: any; actual: any; }[] = [];

  // Check size
  if (commonProps.size && commonProps.size.width !== 'variable') {
    if (button.size.width !== commonProps.size.width) {
      differences.push({
        property: 'width',
        expected: commonProps.size.width,
        actual: button.size.width
      });
    }
  }

  if (commonProps.size && button.size.height !== commonProps.size.height) {
    differences.push({
      property: 'height',
      expected: commonProps.size.height,
      actual: button.size.height
    });
  }

  // Check style
  if (commonProps.style) {
    if (!areArraysEqual(button.style.fills, commonProps.style.fills)) {
      differences.push({
        property: 'fills',
        expected: commonProps.style.fills,
        actual: button.style.fills
      });
    }

    if (!areArraysEqual(button.style.strokes, commonProps.style.strokes)) {
      differences.push({
        property: 'strokes',
        expected: commonProps.style.strokes,
        actual: button.style.strokes
      });
    }

    if (!areArraysEqual(button.style.effects, commonProps.style.effects)) {
      differences.push({
        property: 'effects',
        expected: commonProps.style.effects,
        actual: button.style.effects
      });
    }

    if (button.style.cornerRadius !== commonProps.style.cornerRadius) {
      differences.push({
        property: 'cornerRadius',
        expected: commonProps.style.cornerRadius,
        actual: button.style.cornerRadius
      });
    }
  }

  // Check text style
  if (commonProps.text && button.text) {
    if (button.text.fontSize !== commonProps.text.fontSize) {
      differences.push({
        property: 'fontSize',
        expected: commonProps.text.fontSize,
        actual: button.text.fontSize
      });
    }

    if (button.text.fontWeight !== commonProps.text.fontWeight) {
      differences.push({
        property: 'fontWeight',
        expected: commonProps.text.fontWeight,
        actual: button.text.fontWeight
      });
    }

    if (button.text.textCase !== commonProps.text.textCase) {
      differences.push({
        property: 'textCase',
        expected: commonProps.text.textCase,
        actual: button.text.textCase
      });
    }

    if (button.text.textDecoration !== commonProps.text.textDecoration) {
      differences.push({
        property: 'textDecoration',
        expected: commonProps.text.textDecoration,
        actual: button.text.textDecoration
      });
    }
  }

  return differences;
}

/**
 * Compare two arrays for equality
 */
function areArraysEqual<T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function getTextCase(value: string | undefined): TextCase {
  switch (value) {
    case 'ORIGINAL':
      return 'ORIGINAL';
    case 'UPPER':
      return 'UPPER';
    case 'LOWER':
      return 'LOWER';
    case 'TITLE':
      return 'TITLE';
    default:
      return 'ORIGINAL';
  }
}

function getTextDecoration(value: string | undefined): TextDecoration {
  switch (value) {
    case 'NONE':
      return 'NONE';
    case 'UNDERLINE':
      return 'UNDERLINE';
    case 'STRIKETHROUGH':
      return 'STRIKETHROUGH';
    default:
      return 'NONE';
  }
}
