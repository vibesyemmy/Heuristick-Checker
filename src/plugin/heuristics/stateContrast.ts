/**
 * State Contrast Analysis Module
 * 
 * This module provides functionality to analyze the visual contrast between different
 * states of UI components (hover, focus, pressed, disabled) and ensures they meet
 * accessibility requirements.
 * 
 * Key Features:
 * - State detection from variant properties and naming conventions
 * - Contrast ratio calculations between states
 * - WCAG AA compliance checks for text contrast
 * - Focus indicator visibility validation
 * - Disabled state opacity requirements
 * - Interactivity analysis for hover, focus, and pressed states
 * - Touch target size analysis
 * 
 * @module stateContrast
 */

import { FigmaColor } from './types';
import Color from 'color';
import { defaultButtonConfig } from './config/buttonDetection';

/** Effect types supported by Figma */
type EffectType = 'INNER_SHADOW' | 'DROP_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';

/** Interface for effect properties */
interface Effect {
  type: EffectType;
  color?: {
    color: FigmaColor;
    opacity?: number;
  };
  offset?: {
    x: number;
    y: number;
  };
  radius?: number;
  spread?: number;
  visible?: boolean;
  blendMode?: string;
}

/**
 * Supported UI states for contrast analysis
 */
export type UIState = 'default' | 'hover' | 'focus' | 'pressed' | 'disabled';

/**
 * Keywords used to detect states from node names and variant properties
 */
const STATE_KEYWORDS: Record<UIState, string[]> = {
  default: ['default', 'normal', 'base'],
  hover: ['hover', 'over'],
  focus: ['focus', 'focused'],
  pressed: ['pressed', 'active', 'down'],
  disabled: ['disabled', 'inactive']
};

/**
 * Keywords that indicate an element is interactive
 */
const INTERACTIVE_KEYWORDS = [
  'button',
  'btn',
  'link',
  'tab',
  'checkbox',
  'radio',
  'toggle',
  'switch',
  'dropdown',
  'menu',
  'select',
  'input',
  'slider',
  'scrollbar'
];

/**
 * Contrast thresholds for state differences
 */
const STATE_CONTRAST_THRESHOLDS = {
  MINIMUM_STATE_DIFFERENCE: 1.2,  // Minimum contrast ratio between states
  HOVER_DIFFERENCE: 1.5,         // Recommended contrast difference for hover state
  FOCUS_DIFFERENCE: 2.0,         // Required contrast difference for focus state
  DISABLED_MAX_OPACITY: 0.5      // Maximum opacity for disabled state
};

/**
 * WCAG AA accessibility thresholds
 */
const ACCESSIBILITY_THRESHOLDS = {
  TEXT_CONTRAST_NORMAL: 4.5,      // WCAG AA for normal text
  TEXT_CONTRAST_LARGE: 3.0,       // WCAG AA for large text
  FOCUS_INDICATOR_MIN_WIDTH: 1,   // Minimum width for focus indicators in pixels
  FOCUS_INDICATOR_CONTRAST: 3.0,  // Minimum contrast for focus indicators
  DISABLED_OPACITY_RANGE: {
    MIN: 0.3,  // Minimum opacity for disabled state
    MAX: 0.6   // Maximum opacity for disabled state
  }
};

/**
 * Visual properties that can change between states
 */
interface VisualPropertyChanges {
  color: boolean;
  opacity: boolean;
  border: boolean;
  shadow: boolean;
  shape: boolean;
}

/**
 * Enhanced state variant with detailed property tracking
 */
interface StateVariant {
  state: UIState;
  fillColor: FigmaColor;
  borderColor?: FigmaColor;
  borderWidth?: number;
  effects: Effect[];
  opacity: number;
  fontSize?: number;
  background?: FigmaColor;
  changedProperties: VisualPropertyChanges;
}

/**
 * Detailed state analysis result
 */
interface DetailedStateAnalysis {
  fromState: UIState;
  toState: UIState;
  contrastRatio: number;
  meetsThreshold: boolean;
  changedProperties: VisualPropertyChanges;
  recommendation?: string;
}

/**
 * Detailed issue description with specific measurements
 */
export interface StateContrastIssue {
  type: 'contrast' | 'interactivity' | 'accessibility';
  severity: 'high' | 'medium' | 'low';
  description: string;
  currentValue?: string | number;
  expectedValue?: string | number;
  affectedStates?: UIState[];
  recommendation: string;
}

/**
 * Enhanced result interface with categorized issues
 */
export interface StateContrastResult {
  nodeId: string;
  nodeName: string;
  stateVariants: StateVariant[];
  issues: StateContrastIssue[];
  summary: string;
}

/**
 * Interface for state accessibility results
 */
interface StateAccessibility {
  contrastWithBackground: AccessibilityCheck;
  focusIndicator?: AccessibilityCheck;
  disabledState?: AccessibilityCheck;
}

/**
 * Interface for accessibility checks
 */
interface AccessibilityCheck {
  passed: boolean;
  recommendation?: string;
}

/**
 * Interface for interactivity analysis results
 */
interface InteractivityAnalysis {
  hasHoverState: boolean;
  hasFocusState: boolean;
  hasPressedState: boolean;
  hasVisualAffordance: boolean;
  touchTargetSize: {
    width: number;
    height: number;
    meetsMinimum: boolean;
  };
  recommendations: string[];
}

/**
 * Minimum sizes for touch targets (in pixels)
 */
const TOUCH_TARGET_MINIMUMS = {
  width: 44,
  height: 44
};

/**
 * Determines if a node represents an interactive element
 * 
 * @param node - The node to check
 * @returns Whether the node is likely interactive
 */
/**
 * Determines if a node represents an interactive element by checking its properties,
 * parent components, and naming conventions.
 * 
 * @param node - The node to check
 * @returns Whether the node is likely interactive
 */
async function isInteractiveElement(node: SceneNode): Promise<boolean> {
  // Helper to check if a name contains interactive keywords
  const hasInteractiveKeyword = (name: string): boolean => {
    return INTERACTIVE_KEYWORDS.some(keyword => 
      name.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  // Check node name and description
  if (hasInteractiveKeyword(node.name)) {
    return true;
  }

  // Check if it's an instance of an interactive component
  if (node.type === 'INSTANCE') {
    try {
      const mainComponent = await node.getMainComponentAsync();
      if (mainComponent) {
        // Check component name
        if (hasInteractiveKeyword(mainComponent.name)) {
          return true;
        }
        
        // Check component description
        if ('description' in mainComponent && mainComponent.description) {
          const desc = mainComponent.description.toLowerCase();
          if (desc.includes('button') || desc.includes('interactive') || desc.includes('clickable')) {
            return true;
          }
        }
      }
    } catch (error) {
      console.error('Error getting main component:', error);
    }
  }

  // Check for component set with state variants
  if (node.type === 'COMPONENT_SET' || (node.parent && node.parent.type === 'COMPONENT_SET')) {
    const componentSet = node.type === 'COMPONENT_SET' ? node : node.parent;
    if (componentSet && componentSet.type === 'COMPONENT_SET') {
      // Check for state/interactive variants
      const variantProps = Object.keys(componentSet.componentPropertyDefinitions || {});
      const hasInteractiveProps = variantProps.some(prop => {
        const propLower = prop.toLowerCase();
        return propLower.includes('state') || 
               propLower.includes('hover') || 
               propLower.includes('pressed') || 
               propLower.includes('focus') || 
               propLower.includes('active') || 
               propLower.includes('disabled');
      });
      if (hasInteractiveProps) {
        return true;
      }
    }
  }

  // Check parent components recursively
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'COMPONENT' || parent.type === 'COMPONENT_SET') {
      if (hasInteractiveKeyword(parent.name)) {
        return true;
      }
    }
    parent = parent.parent;
  }

  // Check for common interactive patterns
  if ('children' in node) {
    const children = (node as FrameNode).children;
    // Look for icon + text combinations that might indicate a button
    const hasIcon = children.some(child => 
      child.name.toLowerCase().includes('icon') || 
      child.type === 'VECTOR' || 
      child.type === 'STAR' || 
      child.type === 'ELLIPSE'
    );
    const hasText = children.some(child => 
      child.type === 'TEXT' && 
      !child.name.toLowerCase().includes('label') && 
      !child.name.toLowerCase().includes('caption')
    );
    
    if (hasIcon && hasText) {
      // This might be a button with an icon
      return true;
    }
  }

  // Check for interactive styling
  if ('effects' in node && Array.isArray(node.effects)) {
    const hasHoverEffect = node.effects.some(effect => 
      effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
    );
    const hasBorder = 'strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0;
    const hasBackground = 'fills' in node && Array.isArray(node.fills) && node.fills.length > 0;
    
    // If it has multiple interactive visual properties, it might be interactive
    if ((hasHoverEffect && hasBorder) || (hasHoverEffect && hasBackground)) {
      return true;
    }
  }

  return false;
}

/**
 * Detects UI states from a Figma node using variant properties and naming conventions.
 * 
 * @param node - The Figma node to analyze
 * @returns Array of detected UI states
 */
async function detectStateVariants(node: SceneNode): Promise<UIState[]> {
  const states = new Set<UIState>();
  states.add('default'); // Always include default state

  // Check component properties for state variants
  if ('componentPropertyDefinitions' in node) {
    const props = node.componentPropertyDefinitions || {};
    for (const [key, value] of Object.entries(props)) {
      const keyLower = key.toLowerCase();
      
      // Check each state keyword
      for (const [state, keywords] of Object.entries(STATE_KEYWORDS)) {
        if (keywords.some(keyword => keyLower.includes(keyword))) {
          states.add(state as UIState);
        }
      }
    }
  }

  // Check node name for state indicators
  const nameLower = node.name.toLowerCase();
  for (const [state, keywords] of Object.entries(STATE_KEYWORDS)) {
    if (keywords.some(keyword => nameLower.includes(keyword))) {
      states.add(state as UIState);
    }
  }

  // If it's a component set, check variant properties
  if (node.type === 'COMPONENT_SET') {
    for (const child of node.children) {
      if (child.type === 'COMPONENT') {
        const childNameLower = child.name.toLowerCase();
        for (const [state, keywords] of Object.entries(STATE_KEYWORDS)) {
          if (keywords.some(keyword => childNameLower.includes(keyword))) {
            states.add(state as UIState);
          }
        }
      }
    }
  }

  return Array.from(states);
}

/**
 * Extracts visual properties from a Figma node for a specific state.
 * 
 * @param node - The Figma node to extract properties from
 * @param state - The UI state these properties represent
 * @returns Object containing visual properties
 */
export function extractVisualProperties(node: SceneNode, state: UIState): StateVariant {
  // Safely get fill color if available
  let fillColor: FigmaColor = { r: 1, g: 1, b: 1 };
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0 && (node.fills[0] as SolidPaint).color) {
    fillColor = (node.fills[0] as SolidPaint).color;
  }

  // Use safe check for opacity: if node doesn't have opacity property (e.g., SliceNode), default to 1
  const nodeOpacity = ('opacity' in node && typeof (node as any).opacity === 'number') ? (node as any).opacity : 1;

  return {
    state,
    fillColor,
    effects: ('effects' in node && Array.isArray(node.effects)) ? (node.effects as Effect[]) : [],
    opacity: nodeOpacity,
    changedProperties: {
      color: false,
      opacity: false,
      border: false,
      shadow: false,
      shape: false
    }
    // Additional property extraction as needed
  };
}

/**
 * Calculates the cumulative opacity of a node and its parents.
 * 
 * @param node - The node to calculate opacity for
 * @returns The cumulative opacity value
 */
function getCumulativeOpacity(node: SceneNode | null): number {
  let opacity = 1;
  let current = node;
  
  while (current) {
    // Use type assertion and nullish coalescing for opacity
    opacity *= ('opacity' in current ? (current as any).opacity : 1) ?? 1;
    current = current.parent as SceneNode;
  }
  
  return opacity;
}

/**
 * Detects visual property changes between two state variants.
 * 
 * @param baseState - The base state variant
 * @param compareState - The state variant to compare with
 * @returns Object containing changed properties
 */
function detectVisualPropertyChanges(
  baseState: StateVariant,
  compareState: StateVariant
): VisualPropertyChanges {
  return {
    color: !colorsAreEqual(baseState.fillColor, compareState.fillColor),
    opacity: baseState.opacity !== compareState.opacity,
    border: !colorsAreEqual(baseState.borderColor, compareState.borderColor) ||
            baseState.borderWidth !== compareState.borderWidth,
    shadow: !effectsAreEqual(baseState.effects, compareState.effects),
    shape: false // Will be implemented when we add shape detection
  };
}

/**
 * Checks if two colors are equal.
 * 
 * @param color1 - First color
 * @param color2 - Second color
 * @returns True if colors are equal, false otherwise
 */
function colorsAreEqual(color1?: FigmaColor, color2?: FigmaColor): boolean {
  if (!color1 || !color2) return color1 === color2;
  return color1.r === color2.r && 
         color1.g === color2.g && 
         color1.b === color2.b && 
         (color1.a === color2.a || 
          (color1.a === undefined && color2.a === undefined));
}

/**
 * Checks if two effect arrays are equal.
 * 
 * @param effects1 - First effect array
 * @param effects2 - Second effect array
 * @returns True if effects are equal, false otherwise
 */
function effectsAreEqual(effects1: Effect[], effects2: Effect[]): boolean {
  if (effects1.length !== effects2.length) return false;
  
  return effects1.every((effect1, index) => {
    const effect2 = effects2[index];
    if (!effect2 || effect1.type !== effect2.type) return false;
    
    // Compare shadow properties
    if ((effect1.type === 'DROP_SHADOW' || effect1.type === 'INNER_SHADOW') && 
        (effect2.type === 'DROP_SHADOW' || effect2.type === 'INNER_SHADOW')) {
      if (effect1.color && effect2.color) {
        if (!colorsAreEqual(effect1.color.color, effect2.color.color)) return false;
      } else if (effect1.color !== effect2.color) {
        return false;
      }
      
      if (effect1.offset && effect2.offset) {
        if (effect1.offset.x !== effect2.offset.x || 
            effect1.offset.y !== effect2.offset.y) return false;
      } else if (effect1.offset !== effect2.offset) {
        return false;
      }
      
      if (effect1.spread !== effect2.spread) return false;
    }
    
    // Compare blur properties
    if ((effect1.type === 'LAYER_BLUR' || effect1.type === 'BACKGROUND_BLUR') &&
        (effect2.type === 'LAYER_BLUR' || effect2.type === 'BACKGROUND_BLUR')) {
      if (effect1.radius !== effect2.radius) return false;
    }
    
    return true;
  });
}

/**
 * Calculates the contrast ratio between two state variants.
 * 
 * @param from - The first state variant
 * @param to - The second state variant
 * @returns The contrast ratio between the two states
 */
function calculateStateContrast(from: StateVariant, to: StateVariant): number {
  const getLuminance = (color: FigmaColor, opacity: number = 1) => {
    const toSRGB = (value: number) => {
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    };

    const r = toSRGB(color.r);
    const g = toSRGB(color.g);
    const b = toSRGB(color.b);
    
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) * opacity;
    return luminance;
  };

  const fromLuminance = getLuminance(from.fillColor, from.opacity);
  const toLuminance = getLuminance(to.fillColor, to.opacity);

  // Calculate contrast ratio
  const lighter = Math.max(fromLuminance, toLuminance);
  const darker = Math.min(fromLuminance, toLuminance);

  // Ensure we don't divide by zero
  if (darker === 0) {
    return lighter > 0 ? 21 : 1;  // Maximum contrast if one is black
  }

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Analyzes the contrast between different states of a UI component.
 * 
 * @param variants - The state variants to analyze
 * @returns Array of detailed state analysis results
 */
function analyzeStateContrast(variants: StateVariant[]): DetailedStateAnalysis[] {
  const results: DetailedStateAnalysis[] = [];
  const defaultState = variants.find(v => v.state === 'default');
  
  if (!defaultState) {
    return results;
  }

  // Compare each non-default state with the default state
  const nonDefaultVariants = variants.filter(variant => variant.state !== 'default');
  for (const variant of nonDefaultVariants) {
    const contrastRatio = calculateStateContrast(defaultState, variant);
    const changes = detectVisualPropertyChanges(defaultState, variant);
    
    // Different thresholds for different states
    let requiredThreshold = STATE_CONTRAST_THRESHOLDS.MINIMUM_STATE_DIFFERENCE;
    
    switch (variant.state) {
      case 'hover':
        requiredThreshold = STATE_CONTRAST_THRESHOLDS.HOVER_DIFFERENCE;
        break;
      case 'focus':
        requiredThreshold = STATE_CONTRAST_THRESHOLDS.FOCUS_DIFFERENCE;
        break;
      case 'pressed':
        requiredThreshold = STATE_CONTRAST_THRESHOLDS.HOVER_DIFFERENCE;
        break;
      case 'disabled':
        // For disabled state, we check opacity instead of contrast
        if (variant.opacity > STATE_CONTRAST_THRESHOLDS.DISABLED_MAX_OPACITY) {
          results.push({
            fromState: 'default',
            toState: 'disabled',
            contrastRatio: 1,
            meetsThreshold: false,
            changedProperties: changes,
            recommendation: `Reduce opacity of disabled state to below ${STATE_CONTRAST_THRESHOLDS.DISABLED_MAX_OPACITY * 100}%`
          });
          continue;
        }
        break;
    }

    // Check if the visual change is sufficient
    const hasSignificantChange = 
      (changes.color && contrastRatio >= requiredThreshold) ||
      (changes.border && variant.borderWidth && variant.borderWidth >= 2) ||
      (changes.shadow && variant.effects.some(effect => 
        effect.type === 'DROP_SHADOW' && effect.radius !== undefined && effect.radius >= 4
      ));

    results.push({
      fromState: 'default',
      toState: variant.state,
      contrastRatio,
      meetsThreshold: hasSignificantChange,
      changedProperties: changes,
      recommendation: !hasSignificantChange ? generateRecommendation(variant.state, changes) : undefined
    });
  }

  return results;
}

/**
 * Generates a specific recommendation based on the state and what properties changed
 */
function generateRecommendation(state: UIState, changes: VisualPropertyChanges): string {
  switch (state) {
    case 'hover':
      if (!changes.color && !changes.opacity) {
        return 'Add a distinct hover state by changing the background color or opacity';
      }
      return 'Increase the contrast of the hover state for better visibility';
    
    case 'focus':
      if (!changes.border) {
        return 'Add a visible focus indicator (minimum 2px border) for keyboard navigation';
      }
      return 'Increase the visibility of the focus indicator';
    
    case 'pressed':
      if (!changes.color && !changes.shadow) {
        return 'Add a distinct pressed state using color or shadow changes';
      }
      return 'Make the pressed state more visually distinct from the default state';
    
    case 'disabled':
      return 'Adjust the disabled state to clearly indicate it is not interactive';
    
    default:
      return 'Ensure sufficient visual contrast between states';
  }
}

/**
 * Checks accessibility requirements for a specific state variant.
 * 
 * @param variant - The state variant to check
 * @returns Object containing accessibility check results and recommendations
 */
function checkStateAccessibility(variant: StateVariant): StateAccessibility {
  const result: StateAccessibility = {
    contrastWithBackground: { passed: true }
  };

  // Check contrast with background if available
  if (variant.background) {
    const contrast = calculateContrastRatio(variant.fillColor, variant.background);
    const isLargeText = variant.fontSize && variant.fontSize >= 18;
    const requiredContrast = isLargeText ? 
      ACCESSIBILITY_THRESHOLDS.TEXT_CONTRAST_LARGE : 
      ACCESSIBILITY_THRESHOLDS.TEXT_CONTRAST_NORMAL;

    result.contrastWithBackground = {
      passed: contrast >= requiredContrast,
      recommendation: contrast < requiredContrast ?
        `Increase contrast with background to at least ${requiredContrast}:1 ratio for ${isLargeText ? 'large' : 'normal'} text` :
        undefined
    };
  }

  // Check focus indicator if border color exists
  const borderAlpha = variant.borderColor?.a ?? 1;
  result.focusIndicator = {
    passed: borderAlpha >= 1,
    recommendation: borderAlpha < 1 ? 'Border is too transparent' : undefined
  };

  // Check disabled state opacity
  if (variant.state === 'disabled') {
    const opacity = variant.opacity;
    result.disabledState = {
      passed: opacity >= 0.3 && opacity <= 0.6,
      recommendation: opacity < 0.3 ? 'Disabled state opacity is too low' :
                     opacity > 0.6 ? 'Disabled state opacity is too high' : undefined
    };
  }

  return result;
}

/**
 * Calculates the contrast ratio between two colors according to WCAG standards.
 * 
 * @param color1 - First color
 * @param color2 - Second color
 * @returns Contrast ratio between the colors
 */
function calculateContrastRatio(color1: FigmaColor, color2: FigmaColor): number {
  const getLuminance = (color: FigmaColor) => {
    const toSRGB = (value: number) => {
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    };

    const r = toSRGB(color.r);
    const g = toSRGB(color.g);
    const b = toSRGB(color.b);
    
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b);
    return luminance;
  };

  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  // Ensure we don't divide by zero
  if (darker === 0) {
    return lighter > 0 ? 21 : 1;  // Maximum contrast if one is black
  }

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculates the relative luminance of a color according to WCAG standards.
 * 
 * @param color - The color to calculate luminance for
 * @returns The relative luminance value
 */
function calculateRelativeLuminance(color: FigmaColor): number {
  const toLinear = (val: number) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  };
  
  const r = toLinear(color.r);
  const g = toLinear(color.g);
  const b = toLinear(color.b);
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Analyzes the interactivity indicators of a component
 */
function analyzeInteractivity(node: SceneNode, variants: StateVariant[]): InteractivityAnalysis {
  // Initialize result
  const result: InteractivityAnalysis = {
    hasHoverState: false,
    hasFocusState: false,
    hasPressedState: false,
    hasVisualAffordance: false,
    touchTargetSize: {
      width: 0,
      height: 0,
      meetsMinimum: false
    },
    recommendations: []
  };

  // Get default state as baseline for comparison
  const defaultState = variants.find(v => v.state === 'default');
  if (!defaultState) return result;

  // Check for hover state and its visual distinction
  const hoverState = variants.find(v => v.state === 'hover');
  if (hoverState) {
    const changes = detectVisualPropertyChanges(defaultState, hoverState);
    result.hasHoverState = changes.color || changes.opacity || changes.shadow || changes.border;
  }

  // Check for focus state and its visual distinction
  const focusState = variants.find(v => v.state === 'focus');
  if (focusState) {
    const changes = detectVisualPropertyChanges(defaultState, focusState);
    // Focus state specifically needs a visible outline or strong color change
    result.hasFocusState = (changes.border && focusState.borderWidth && focusState.borderWidth >= 2) || 
                          (changes.color && calculateStateContrast(defaultState, focusState) >= STATE_CONTRAST_THRESHOLDS.FOCUS_DIFFERENCE);
  }

  // Check for pressed state and its visual distinction
  const pressedState = variants.find(v => v.state === 'pressed');
  if (pressedState) {
    const changes = detectVisualPropertyChanges(defaultState, pressedState);
    result.hasPressedState = changes.color || changes.opacity || changes.shadow;
  }

  // Check for visual affordances in default state
  result.hasVisualAffordance = Boolean(
    defaultState.borderWidth || // Has border
    defaultState.effects.some(effect => effect.type === 'DROP_SHADOW') || // Has shadow
    (defaultState.fillColor && defaultState.fillColor.a !== undefined && defaultState.fillColor.a > 0) || // Has fill
    ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0) // Has rounded corners
  );

  // Check touch target size
  if ('width' in node && 'height' in node) {
    result.touchTargetSize = {
      width: node.width,
      height: node.height,
      meetsMinimum: node.width >= TOUCH_TARGET_MINIMUMS.width && 
                    node.height >= TOUCH_TARGET_MINIMUMS.height
    };
  }

  return result;
}

/**
 * Formats a contrast issue with specific measurements
 * 
 * @param fromState - The first state
 * @param toState - The second state
 * @param contrastRatio - The contrast ratio between the states
 * @param threshold - The minimum contrast ratio required
 * @returns The formatted issue
 */
function formatContrastIssue(
  fromState: UIState,
  toState: UIState,
  contrastRatio: number,
  threshold: number
): StateContrastIssue {
  return {
    type: 'contrast',
    severity: contrastRatio < threshold * 0.5 ? 'high' : 'medium',
    description: `Insufficient contrast between ${fromState} and ${toState} states`,
    currentValue: Number(contrastRatio.toFixed(2)),
    expectedValue: threshold,
    affectedStates: [fromState, toState],
    recommendation: `Increase the visual difference between ${fromState} and ${toState} states to achieve a contrast ratio of at least ${threshold}:1 (currently ${contrastRatio.toFixed(2)}:1)`
  };
}

/**
 * Formats an interactivity issue with specific measurements
 * 
 * @param issue - The type of interactivity issue
 * @param node - The node being analyzed
 * @returns The formatted issue
 */
function formatInteractivityIssue(
  issue: 'hover' | 'focus' | 'pressed' | 'affordance',
  node: SceneNode
): StateContrastIssue {
  const isInteractive = /button|btn|cta|submit/i.test(node.name);
  switch (issue) {
    case 'hover':
      return {
        type: 'interactivity',
        severity: 'medium',
        description: 'Missing hover state',
        affectedStates: ['hover'],
        recommendation: isInteractive ? 'Add a hover state to provide visual feedback when users interact with this element' : ''
      };
    case 'focus':
      return {
        type: 'interactivity',
        severity: 'high',
        description: 'Missing focus indicator',
        affectedStates: ['focus'],
        recommendation: isInteractive ? 'Add a visible focus indicator (e.g., outline with minimum 2px width) for keyboard navigation' : ''
      };
    case 'pressed':
      return {
        type: 'interactivity',
        severity: 'medium',
        description: 'Missing pressed state',
        affectedStates: ['pressed'],
        recommendation: isInteractive ? 'Add a pressed/active state to provide feedback during clicks/taps' : ''
      };
    case 'affordance':
      return {
        type: 'interactivity',
        severity: 'high',
        description: 'No visual indication of interactivity',
        recommendation: isInteractive ? 'Add visual affordances (e.g., border, shadow, or underline) to indicate this element is interactive' : ''
      };
    default:
      throw new Error('Unknown interactivity issue');
  }
}

/**
 * Formats an accessibility issue with specific measurements
 * 
 * @param issue - The type of accessibility issue
 * @param details - Additional details about the issue
 * @returns The formatted issue
 */
function formatAccessibilityIssue(
  issue: 'touchTarget' | 'colorOnly',
  details?: { width?: number; height?: number }
): StateContrastIssue {
  switch (issue) {
    case 'touchTarget':
      return {
        type: 'accessibility',
        severity: 'high',
        description: 'Touch target size too small',
        currentValue: `${details?.width}x${details?.height}px`,
        expectedValue: `${TOUCH_TARGET_MINIMUMS.width}x${TOUCH_TARGET_MINIMUMS.height}px`,
        recommendation: `Increase touch target size to at least ${TOUCH_TARGET_MINIMUMS.width}x${TOUCH_TARGET_MINIMUMS.height}px for better touch accessibility`
      };
    case 'colorOnly':
      return {
        type: 'accessibility',
        severity: 'high',
        description: 'States differ only by color',
        recommendation: 'Add non-color indicators (e.g., icons, patterns, or shapes) to ensure states are distinguishable for colorblind users'
      };
    default:
      throw new Error('Unknown accessibility issue');
  }
}

/**
 * Generates a summary of the issues found
 * 
 * @param issues - The issues to summarize
 * @returns The summary
 */
function generateResultSummary(issues: StateContrastIssue[]): string {
  const issueTypes = new Set(issues.map(i => i.type));
  const severities = new Set(issues.map(i => i.severity));
  
  if (issues.length === 0) {
    return 'All state contrast and accessibility checks passed';
  }

  const summary = [];
  
  if (severities.has('high')) {
    summary.push('Critical accessibility issues found');
  }
  
  if (issueTypes.has('contrast')) {
    summary.push('State contrast problems detected');
  }
  
  if (issueTypes.has('interactivity')) {
    summary.push('Missing interaction states');
  }
  
  return summary.join('. ');
}

/**
 * Evaluates the contrast and accessibility of different states for a UI component.
 * 
 * @param node - The Figma node to evaluate
 * @returns Array of analysis results with recommendations
 * 
 * @example
 * ```typescript
 * const results = evaluateStateContrast(buttonNode);
 * console.log(results[0].recommendations);
 * // ["Increase hover state contrast", "Add focus indicator"]
 * ```
 */
/**
 * Analyzes a single node for state contrast issues
 */
async function analyzeNodeStateContrast(node: SceneNode): Promise<StateContrastResult[]> {
  try {
    // First verify this is an instance with proper states
    if (node.type !== 'INSTANCE') {
      return [{
        nodeId: node.id,
        nodeName: node.name,
        stateVariants: [],
        issues: [{
          type: 'interactivity',
          severity: 'high',
          description: 'Interactive element is not an instance',
          recommendation: 'Convert to a component instance to enable state management'
        }],
        summary: 'Element needs to be an instance for state analysis'
      }];
    }

    // Get the component properties that represent states
    const stateProps = Object.entries(node.componentProperties)
      .filter(([key]) => {
        const lowerKey = key.toLowerCase();
        return lowerKey.includes('hover') || 
               lowerKey.includes('pressed') || 
               lowerKey.includes('focus');
      });

    if (stateProps.length === 0) {
      return [{
        nodeId: node.id,
        nodeName: node.name,
        stateVariants: [],
        issues: [{
          type: 'interactivity',
          severity: 'high',
          description: 'Component lacks state properties',
          recommendation: 'Add hover, pressed, and focus states as component properties'
        }],
        summary: 'Component needs state properties for analysis'
      }];
    }

    // Map component properties to state variants
    const stateVariants: StateVariant[] = [];
    
    // Add default state
    stateVariants.push(extractVisualProperties(node, 'default'));

    // Add variants for each state property
    for (const [propName] of stateProps) {
      const state = propName.toLowerCase().includes('hover') ? 'hover' :
                    propName.toLowerCase().includes('pressed') ? 'pressed' :
                    propName.toLowerCase().includes('focus') ? 'focus' : null;
      
      if (state) {
        stateVariants.push(extractVisualProperties(node, state));
      }
    }

    // Initialize result
    const result: StateContrastResult = {
      nodeId: node.id,
      nodeName: node.name,
      stateVariants: stateVariants,
      issues: [],
      summary: ''
    };

    // Analyze state contrast
    const contrastAnalysis = analyzeStateContrast(stateVariants);
    
    // Check accessibility for each state
    const accessibilityResults = stateVariants.map(variant => 
      checkStateAccessibility(variant)
    );

    // Analyze interactivity
    const interactivityAnalysis = analyzeInteractivity(node, stateVariants);

    // Collect issues
    result.issues = [
      ...contrastAnalysis.map(analysis => {
        if (!analysis.meetsThreshold) {
          return formatContrastIssue(
            analysis.fromState,
            analysis.toState,
            analysis.contrastRatio,
            STATE_CONTRAST_THRESHOLDS.MINIMUM_STATE_DIFFERENCE
          );
        }
        return null;
      }).filter((issue): issue is StateContrastIssue => issue !== null),
      
      // Add interactivity issues based on missing states
      ...(!stateProps.some(([key]) => key.toLowerCase().includes('hover')) ? 
          [formatInteractivityIssue('hover', node)] : []),
      ...(!stateProps.some(([key]) => key.toLowerCase().includes('focus')) ? 
          [formatInteractivityIssue('focus', node)] : []),
      ...(!stateProps.some(([key]) => key.toLowerCase().includes('pressed')) ? 
          [formatInteractivityIssue('pressed', node)] : []),
      ...(!interactivityAnalysis.hasVisualAffordance ? 
          [formatInteractivityIssue('affordance', node)] : [])
    ];

    // Generate summary
    result.summary = generateResultSummary(result.issues);

    return [result];
  } catch (error) {
    console.error('Error in state contrast evaluation:', error);
    return [{
      nodeId: node.id,
      nodeName: node.name,
      stateVariants: [],
      issues: [{
        type: 'contrast',
        severity: 'high',
        description: 'Error analyzing state contrast',
        recommendation: `Error: ${error instanceof Error ? error.message : String(error)}`,
        affectedStates: ['hover', 'focus', 'pressed']
      }],
      summary: 'Error occurred during state contrast analysis'
    }];
  }
}

/**
 * Recursively evaluates state contrast for a node and all its children
 */
export async function evaluateStateContrast(node: SceneNode): Promise<StateContrastResult[]> {
  let results: StateContrastResult[] = [];

  // First, analyze if this is a proper interactive element with states
  const isInteractive = await isInteractiveElement(node);
  
  if (isInteractive) {
    const nodeStateResults = await analyzeNodeStateContrast(node);
    results.push(...nodeStateResults);
  }

  // If this node can have children, recursively check them
  if ('children' in node) {
    for (const child of node.children) {
      const childResults = await evaluateStateContrast(child);
      results = results.concat(childResults);
    }
  }

  return results;
}