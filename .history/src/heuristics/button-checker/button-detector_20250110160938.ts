import { ButtonDetectionResult, ButtonProperties, ButtonText, TextCase, TextDecoration, Paint, Effect, RGB } from './types';

/**
 * Detects button-like elements in a Figma node
 */
export function detectButtons(node: SceneNode): ButtonDetectionResult[] {
  const results: ButtonDetectionResult[] = [];

  // Check if the node itself is a button
  if (isButtonLike(node)) {
    results.push(createButtonDetectionResult(node));
  }

  // Recursively check children
  if ('children' in node) {
    node.children.forEach(child => {
      results.push(...detectButtons(child));
    });
  }

  return results;
}

/**
 * Checks if a node is button-like
 */
function isButtonLike(node: SceneNode): boolean {
  const hasInteraction = node.reactions && node.reactions.length > 0;
  const hasButtonName = node.name.toLowerCase().includes('button');
  const hasClickHandler = node.reactions?.some((r: any) => r.action.type === 'NODE');
  
  return hasInteraction || hasButtonName || hasClickHandler;
}

/**
 * Converts a ButtonDetectionResult into ButtonProperties
 */
export function convertToButtonProperties(result: ButtonDetectionResult): ButtonProperties {
  const { node } = result;

  const textProperties = getTextProperties(node);
  const styleProperties = getStyleProperties(node);
  const sizeProperties = getSizeProperties(node);
  const stateProperties = getStateProperties(node);

  return {
    id: node.id,
    name: node.name,
    text: textProperties,
    style: styleProperties,
    size: sizeProperties,
    states: stateProperties
  };
}

function isFrameOrComponent(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE';
}

function isTextNode(node: SceneNode): node is TextNode {
  return node.type === 'TEXT';
}

function getTextNode(node: SceneNode): TextNode | null {
  if (isTextNode(node)) {
    return node;
  }
  if (isFrameOrComponent(node)) {
    for (const child of node.children) {
      const textNode = getTextNode(child);
      if (textNode) {
        return textNode;
      }
    }
  }
  return null;
}

function convertFigmaPaint(paint: any): Paint {
  return {
    type: paint.type,
    color: paint.color ? {
      r: paint.color.r,
      g: paint.color.g,
      b: paint.color.b
    } : undefined,
    opacity: paint.opacity,
    blendMode: paint.blendMode,
    visible: paint.visible
  };
}

function convertFigmaEffect(effect: any): Effect {
  return {
    type: effect.type,
    visible: effect.visible,
    radius: effect.radius,
    spread: effect.spread,
    color: effect.color ? {
      r: effect.color.r,
      g: effect.color.g,
      b: effect.color.b,
      a: effect.color.a
    } : undefined,
    offset: effect.offset,
    blendMode: effect.blendMode
  };
}

function getTextProperties(node: SceneNode): ButtonText {
  const textNode = getTextNode(node);
  if (!textNode) {
    return {
      fontSize: 0,
      fontWeight: 400,
      textCase: 'ORIGINAL',
      textDecoration: 'NONE'
    };
  }

  return {
    fontSize: typeof textNode.fontSize === 'number' ? textNode.fontSize : 0,
    fontWeight: typeof textNode.fontWeight === 'number' ? textNode.fontWeight : 400,
    textCase: textNode.textCase as TextCase || 'ORIGINAL',
    textDecoration: textNode.textDecoration as TextDecoration || 'NONE'
  };
}

function getStyleProperties(node: SceneNode) {
  if (!isFrameOrComponent(node)) {
    return {
      fills: [],
      strokes: [],
      effects: [],
      cornerRadius: 0
    };
  }

  const fills = Array.isArray(node.fills) ? node.fills.map(convertFigmaPaint) : [];
  const strokes = Array.isArray(node.strokes) ? node.strokes.map(convertFigmaPaint) : [];
  const effects = Array.isArray(node.effects) ? node.effects.map(convertFigmaEffect) : [];

  return {
    fills,
    strokes,
    effects,
import { ButtonDetectionResult, ButtonProperties } from './types';

/**
 * Detects button-like elements in a Figma node
 */
export function detectButtons(node: SceneNode): ButtonDetectionResult[] {
  const results: ButtonDetectionResult[] = [];

  // Check if the node itself is a button
  if (isButtonLike(node)) {
    results.push(createButtonDetectionResult(node));
  }

  // Recursively check children
  if ('children' in node) {
    node.children.forEach(child => {
      results.push(...detectButtons(child));
    });
  }

  return results;
}

/**
 * Checks if a node is button-like
 */
function isButtonLike(node: SceneNode): boolean {
  // Check if node has button-like properties
  if (!('fills' in node) && !('strokes' in node) && !('effects' in node)) {
    return false;
  }

  // Check if node has button-like name
  const buttonKeywords = ['button', 'btn', 'cta'];
  const nodeName = node.name.toLowerCase();
  const hasButtonKeyword = buttonKeywords.some(keyword => nodeName.includes(keyword));

  // Check if node has button-like properties
  const hasInteractiveProperties = 
    ('fills' in node && node.fills && Array.isArray(node.fills) && node.fills.length > 0) ||
    ('strokes' in node && node.strokes && Array.isArray(node.strokes) && node.strokes.length > 0) ||
    ('effects' in node && node.effects && Array.isArray(node.effects) && node.effects.length > 0);

  return hasButtonKeyword || hasInteractiveProperties;
}

/**
 * Converts a ButtonDetectionResult into ButtonProperties
 */
export function convertToButtonProperties(result: ButtonDetectionResult): ButtonProperties {
  const { node } = result;
  const textNode = findTextNode(node);

  return {
    id: node.id,
    name: node.name,
    style: {
      fills: ('fills' in node && node.fills && node.fills !== figma.mixed) ? 
        Array.from(node.fills) : [],
      strokes: ('strokes' in node && node.strokes && node.strokes !== figma.mixed) ? 
        Array.from(node.strokes) : [],
      effects: ('effects' in node && node.effects && node.effects !== figma.mixed) ? 
        Array.from(node.effects) : [],
      cornerRadius: ('cornerRadius' in node) ? 
        (typeof node.cornerRadius === 'number' ? node.cornerRadius : 0) : 
        0
    },
    size: {
      width: node.width,
      height: node.height,
      padding: 0 // TODO: Calculate actual padding
    },
    text: textNode ? {
      fontSize: textNode.fontSize === figma.mixed ? 14 : textNode.fontSize,
      fontWeight: textNode.fontWeight === figma.mixed ? 400 : textNode.fontWeight,
      textCase: textNode.textCase === figma.mixed ? 'ORIGINAL' : textNode.textCase,
      textDecoration: textNode.textDecoration === figma.mixed ? 'NONE' : textNode.textDecoration
    } : undefined,
    states: {
      hasHoverState: false,
      hasPressedState: false,
      hasDisabledState: false
    }
  };
}

/**
 * Creates a ButtonDetectionResult from a SceneNode
 */
function createButtonDetectionResult(node: SceneNode): ButtonDetectionResult {
  return {
    node,
    properties: convertToButtonProperties({ node, properties: {} as ButtonProperties })
  };
}

/**
 * Finds the text node within a button
 */
function findTextNode(node: SceneNode): TextNode | null {
  if ('characters' in node) {
    return node;
  }

  if ('children' in node) {
    for (const child of node.children) {
      const textNode = findTextNode(child);
      if (textNode) {
        return textNode;
      }
    }
  }

  return null;
}

/**
 * Checks if a node has a variant
 */
function hasVariant(node: SceneNode, state: string): boolean {
  // Check if node is part of a component set with variants
  if ('parent' in node && node.parent && node.parent.type === 'COMPONENT_SET') {
    const componentSet = node.parent;
    const variantProperties = Object.values(componentSet.variantGroupProperties);
    return variantProperties.some(group => 
      group.values.some((value: string) => value.toLowerCase().includes(state))
    );
  }
  return false;
}
