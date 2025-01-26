import { ButtonDetectionConfig, ButtonDetectionResult, ButtonDetectionDebugLevel } from '../config/buttonDetection';

export const BUTTON_CONTRAST_REQUIREMENTS = {
  outline: {
    stroke: {
      minimum: 3
    }
  },
  boundary: {
    minimum: 3
  }
};

interface ScoreComponent {
  score: number;
  reason?: string;
}

interface Paint {
  type: string;
  visible?: boolean;
  color?: {
    r: number;
    g: number;
    b: number;
  };
  opacity?: number;
}

interface ButtonStyle {
  type: 'solid' | 'outline' | 'mixed';
  backgroundColor?: {
    r: number;
    g: number;
    b: number;
  };
  strokeColor?: {
    r: number;
    g: number;
    b: number;
  };
  strokeWeight?: number;
  fillOpacity?: number;
}

export function detectButton(
  node: SceneNode,
  config: ButtonDetectionConfig,
  debugLevel: ButtonDetectionDebugLevel = ButtonDetectionDebugLevel.NONE
): ButtonDetectionResult {
  try {
    const result: ButtonDetectionResult = {
      isButton: false,
      score: 0,
      reasons: [],
    };

    if (debugLevel >= ButtonDetectionDebugLevel.DETAILED) {
      result.debugInfo = {
        namingScore: 0,
        structureScore: 0,
        dimensionScore: 0,
        styleScore: 0,
        actionWordsScore: 0,
      };
    }

    // 1. Check naming patterns
    const namingScore = checkNaming(node, config);
    result.score += namingScore.score;
    if (namingScore.reason) result.reasons.push(namingScore.reason);
    if (result.debugInfo) result.debugInfo.namingScore = namingScore.score;

    // 2. Check structure
    const structureScore = checkStructure(node);
    result.score += structureScore.score;
    if (structureScore.reason) result.reasons.push(structureScore.reason);
    if (result.debugInfo) result.debugInfo.structureScore = structureScore.score;

    // 3. Check dimensions
    const dimensionScore = checkDimensions(node, config);
    result.score += dimensionScore.score;
    if (dimensionScore.reason) result.reasons.push(dimensionScore.reason);
    if (result.debugInfo) result.debugInfo.dimensionScore = dimensionScore.score;

    // 4. Check styles
    const styleScore = checkStyles(node, config);
    result.score += styleScore.score;
    if (styleScore.reason) result.reasons.push(styleScore.reason);
    if (result.debugInfo) result.debugInfo.styleScore = styleScore.score;

    // 5. Check for action words in text content
    const actionWordsScore = checkActionWords(node, config);
    result.score += actionWordsScore.score;
    if (actionWordsScore.reason) result.reasons.push(actionWordsScore.reason);
    if (result.debugInfo) result.debugInfo.actionWordsScore = actionWordsScore.score;

    result.isButton = result.score >= config.minScore;

    if (debugLevel >= ButtonDetectionDebugLevel.BASIC) {
      console.log('Button detection for node:', node.name, {
        score: result.score,
        isButton: result.isButton,
        reasons: result.reasons,
        debugInfo: result.debugInfo
      });
    }

    return result;
  } catch (error) {
    console.error('Error in button detection for node:', node.name, error);
    return {
      isButton: false,
      score: 0,
      reasons: ['Error during detection']
    };
  }
}

function checkNaming(node: SceneNode, config: ButtonDetectionConfig): ScoreComponent {
  const nameLower = node.name.toLowerCase();
  
  // Direct button naming (highest confidence)
  if (config.namingPatterns.some(pattern => nameLower.includes(pattern))) {
    return { score: 5, reason: 'Named as button component' };
  }

  // Check if it's an instance of a button component
  if (node.type === 'INSTANCE' && node.mainComponent) {
    const mainComponentName = node.mainComponent.name.toLowerCase();
    if (config.namingPatterns.some(pattern => mainComponentName.includes(pattern))) {
      return { score: 4, reason: 'Instance of button component' };
    }
  }

  return { score: 0 };
}

function checkStructure(node: SceneNode): ScoreComponent {
  if (!('children' in node)) {
    return { score: 0 };
  }

  const children = node.children;
  const textNodes = children.filter(child => child.type === 'TEXT');
  const iconNodes = children.filter(child => 
    child.type === 'VECTOR' || 
    child.type === 'FRAME' || 
    child.name.toLowerCase().includes('icon')
  );

  // Common button structure: 1 text + optional icon
  if (textNodes.length === 1 && iconNodes.length <= 1) {
    return { 
      score: 3, 
      reason: `Standard button structure (${textNodes.length} text + ${iconNodes.length} icon)`
    };
  }

  // Icon-only button
  if (textNodes.length === 0 && iconNodes.length === 1) {
    return { score: 2, reason: 'Icon-only button structure' };
  }

  return { score: 0 };
}

function checkDimensions(node: SceneNode, config: ButtonDetectionConfig): ScoreComponent {
  if (!('width' in node) || !('height' in node)) {
    return { score: 0 };
  }

  const { width, height } = node;
  const { minHeight, maxHeight, minWidth, maxWidth } = config.dimensionRanges;

  if (height >= minHeight && height <= maxHeight && 
      width >= minWidth && width <= maxWidth) {
    return { score: 2, reason: 'Common button dimensions' };
  }

  // Special case for icon-only buttons (square)
  if (width === height && width >= minHeight && width <= maxHeight) {
    return { score: 1, reason: 'Icon button dimensions' };
  }

  return { score: 0 };
}

function getButtonStyle(node: SceneNode): ButtonStyle | null {
  try {
    if (!('fills' in node)) return null;
    
    const fills = (node as any).fills as Paint[];
    const strokes = (node as any).strokes as Paint[];
    const strokeWeight = (node as any).strokeWeight as number;
    
    console.log('Analyzing button style for:', node.name, {
      fills: fills?.length,
      strokes: strokes?.length,
      strokeWeight
    });

    // Check for solid fill
    const solidFill = fills?.find((fill: Paint) => fill.type === 'SOLID' && fill.visible !== false);
    if (solidFill && (!strokes || strokes.length === 0)) {
      console.log('Detected solid button:', node.name);
      return {
        type: 'solid',
        backgroundColor: solidFill.color
      };
    }

    // Check for outline
    const solidStroke = strokes?.find((stroke: Paint) => stroke.type === 'SOLID' && stroke.visible !== false);
    if (solidStroke && (!fills || fills.length === 0 || fills.every((fill: Paint) => !fill.visible))) {
      console.log('Detected outline button:', node.name);
      return {
        type: 'outline',
        strokeColor: solidStroke.color,
        strokeWeight: strokeWeight
      };
    }

    // Check for mixed style (both fill and stroke)
    if (solidFill && solidStroke) {
      console.log('Detected mixed style button:', node.name);
      return {
        type: 'mixed',
        backgroundColor: solidFill.color,
        strokeColor: solidStroke.color,
        strokeWeight: strokeWeight,
        fillOpacity: solidFill.opacity
      };
    }

    console.log('No valid button style detected for:', node.name);
    return null;
  } catch (error) {
    console.error('Error getting button style:', error);
    return null;
  }
}

function checkStyles(node: SceneNode, config: ButtonDetectionConfig): ScoreComponent {
  let score = 0;
  const reasons: string[] = [];

  const buttonStyle = getButtonStyle(node);
  if (buttonStyle) {
    score += 1;
    reasons.push(`Button style: ${buttonStyle.type}`);
  }

  // Check for corner radius
  if ('cornerRadius' in node) {
    let radius: number;
    if (typeof node.cornerRadius === 'number') {
      radius = node.cornerRadius;
    } else if (Array.isArray(node.cornerRadius)) {
      radius = Math.max(...node.cornerRadius);
    } else {
      radius = 0; // Default if mixed or undefined
    }
    
    if (config.commonRadii.includes(radius)) {
      score += 1;
      reasons.push('Common button radius');
    }
  }

  return { 
    score,
    reason: reasons.length > 0 ? reasons.join(', ') : undefined
  };
}

function checkActionWords(node: SceneNode, config: ButtonDetectionConfig): ScoreComponent {
  if (!('children' in node)) {
    return { score: 0 };
  }

  const textNodes = node.children.filter(child => child.type === 'TEXT');
  
  for (const textNode of textNodes) {
    if ('characters' in textNode) {
      const text = textNode.characters.toLowerCase();
      const matchedAction = config.commonActionWords.find(word => text.includes(word));
      
      if (matchedAction) {
        return { 
          score: 2, 
          reason: `Contains action word: "${matchedAction}"`
        };
      }
    }
  }

  return { score: 0 };
}
