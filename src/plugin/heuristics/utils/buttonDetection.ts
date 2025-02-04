import { ButtonDetectionConfig, ButtonDetectionResult, ButtonDetectionDebugLevel } from '../config/buttonDetection';
import { isIconNode } from '../iconDetection';

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

export async function detectButton(
  node: SceneNode,
  config: ButtonDetectionConfig,
  debugLevel: ButtonDetectionDebugLevel = ButtonDetectionDebugLevel.NONE
): Promise<ButtonDetectionResult> {
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

    // Early return conditions
    if (await isIconNode(node)) {
      if (debugLevel >= ButtonDetectionDebugLevel.BASIC) {
        console.log('Node is an icon, skipping button detection:', node.name);
      }
      return result;
    }

    // Skip frames that are clearly containers
    if (node.type === 'FRAME') {
      // Check if frame has auto-layout or constraints that suggest it's a container
      if ('layoutMode' in node && node.layoutMode !== 'NONE') {
        if (debugLevel >= ButtonDetectionDebugLevel.BASIC) {
          console.log('Node is a layout frame, skipping button detection:', node.name);
        }
        return result;
      }

      // Check if frame has too many children to be a button
      if ('children' in node && node.children.length > 3) {
        if (debugLevel >= ButtonDetectionDebugLevel.BASIC) {
          console.log('Frame has too many children to be a button:', node.name);
        }
        return result;
      }
    }

    // Run all checks
    const [namingScore, styleScore] = await Promise.all([
      checkNaming(node, config),
      checkStyles(node, config)
    ]);

    const structureScore = checkStructure(node);
    const dimensionScore = checkDimensions(node, config);
    const actionWordsScore = checkActionWords(node, config);

    // Add scores
    result.score += namingScore.score;
    result.score += structureScore.score;
    result.score += dimensionScore.score;
    result.score += styleScore.score;
    result.score += actionWordsScore.score;

    // Add reasons
    if (namingScore.reason) result.reasons.push(namingScore.reason);
    if (structureScore.reason) result.reasons.push(structureScore.reason);
    if (dimensionScore.reason) result.reasons.push(dimensionScore.reason);
    if (styleScore.reason) result.reasons.push(styleScore.reason);
    if (actionWordsScore.reason) result.reasons.push(actionWordsScore.reason);

    // Update debug info
    if (result.debugInfo) {
      result.debugInfo.namingScore = namingScore.score;
      result.debugInfo.structureScore = structureScore.score;
      result.debugInfo.dimensionScore = dimensionScore.score;
      result.debugInfo.styleScore = styleScore.score;
      result.debugInfo.actionWordsScore = actionWordsScore.score;
    }

    result.isButton = result.score >= config.minScore;

    if (debugLevel >= ButtonDetectionDebugLevel.BASIC) {
      console.log('Button detection for node:', node.name, '►', {
        isButton: result.isButton,
        score: result.score,
        reasons: result.reasons,
        debugInfo: result.debugInfo
      });
    }

    return result;
  } catch (error) {
    console.error('Error in button detection:', error);
    return {
      isButton: false,
      score: 0,
      reasons: ['Error during detection: ' + (error instanceof Error ? error.message : String(error))]
    };
  }
}

async function checkNaming(node: SceneNode, config: ButtonDetectionConfig): Promise<ScoreComponent> {
  // Check if it's an instance of a button component first
  if (node.type === 'INSTANCE') {
    try {
      const mainComponent = await node.getMainComponentAsync();
      if (mainComponent) {
        const mainComponentName = mainComponent.name.toLowerCase();
        // Check full component path
        const fullPath = mainComponent.parent ? `${mainComponent.parent.name}/${mainComponentName}` : mainComponentName;
        
        for (const pattern of config.namingPatterns) {
          if (new RegExp(pattern).test(fullPath)) {
            return { score: 5, reason: 'Instance of button component' };
          }
        }

        // Check variant properties for interactive states
        if ('componentProperties' in node) {
          const hasInteractiveProps = Object.keys(node.componentProperties).some(prop => 
            prop.toLowerCase().includes('hover') || 
            prop.toLowerCase().includes('pressed') || 
            prop.toLowerCase().includes('focus')
          );
          if (hasInteractiveProps) {
            return { score: 4, reason: 'Has interactive state variants' };
          }
        }
      }
    } catch (error) {
      console.log('Could not access main component:', error);
    }
  }

  // Direct button naming (lower confidence than component instance)
  const nameLower = node.name.toLowerCase();
  for (const pattern of config.namingPatterns) {
    if (new RegExp(pattern).test(nameLower)) {
      return { score: 3, reason: 'Named as button' };
    }
  }

  return { score: 0 };
}

function checkStructure(node: SceneNode): ScoreComponent {
  if (!('children' in node)) {
    return { score: 0 };
  }

  // Skip if node is a frame with layout properties that suggest it's a container
  if (node.type === 'FRAME') {
    if ('layoutMode' in node && node.layoutMode !== 'NONE') {
      return { score: 0, reason: 'Frame is a container with layout' };
    }
    if (node.children.length > 3) {
      return { score: 0, reason: 'Frame has too many children' };
    }
  }

  const children = node.children;
  const textNodes = children.filter(child => child.type === 'TEXT');
  const iconNodes = children.filter(child => 
    child.type === 'VECTOR' || 
    (child.type === 'INSTANCE' && child.name.toLowerCase().includes('icon'))
  );

  // Common button structure: 1 text + optional icon
  if (textNodes.length === 1 && iconNodes.length <= 1) {
    return { 
      score: 3, 
      reason: `Standard button structure (${textNodes.length} text + ${iconNodes.length} icon)`
    };
  }

  // Icon-only button - be more strict
  if (textNodes.length === 0 && iconNodes.length === 1) {
    // For icon-only buttons, require stronger naming evidence
    const hasButtonName = node.name.toLowerCase().includes('button') || 
                         (node.type === 'INSTANCE' && node.mainComponent?.name.toLowerCase().includes('button'));
    if (hasButtonName) {
      return { score: 2, reason: 'Icon-only button structure with button naming' };
    }
  }

  return { score: 0 };
}

function checkDimensions(node: SceneNode, config: ButtonDetectionConfig): ScoreComponent {
  if (!('width' in node) || !('height' in node)) {
    return { score: 0 };
  }

  const { width, height } = node;
  const { minHeight, maxHeight, minWidth, maxWidth } = config.dimensionRanges;

  // Standard button dimensions
  if (height >= minHeight && height <= maxHeight && 
      width >= minWidth && width <= maxWidth) {
    return { score: 2, reason: 'Common button dimensions' };
  }

  // Icon-only buttons must be explicitly named as buttons
  if (width === height && 
      width >= minHeight && 
      width <= maxHeight && 
      node.name.toLowerCase().includes('button')) {
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

async function checkStyles(node: SceneNode, config: ButtonDetectionConfig): Promise<ScoreComponent> {
  // Skip if this is a frame with layout properties
  if (node.type === 'FRAME' && 'layoutMode' in node && node.layoutMode !== 'NONE') {
    return { score: 0, reason: 'Frame with layout mode' };
  }

  let score = 0;
  const reasons: string[] = [];

  const buttonStyle = getButtonStyle(node);
  if (!buttonStyle) {
    return { score: 0 };
  }

  // Skip if this is a frame with no explicit background or stroke
  if (node.type === 'FRAME' && (!buttonStyle.backgroundColor || buttonStyle.fillOpacity === 0)) {
    return { score: 0, reason: 'Frame without explicit background' };
  }

  // Check for interactive states first (both instances and components)
  if ((node.type === 'INSTANCE' && 'componentProperties' in node) || 
      (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET')) {
    try {
      const props = node.type === 'INSTANCE' ? 
        Object.keys(node.componentProperties) :
        Object.keys(node.componentPropertyDefinitions || {});

      const hasInteractiveStates = props.some(prop => 
        prop.toLowerCase().includes('hover') || 
        prop.toLowerCase().includes('pressed') || 
        prop.toLowerCase().includes('focus')
      );
      if (hasInteractiveStates) {
        score += 3;
        reasons.push('Has interactive states');
      }
    } catch (error) {
      console.log('Could not check interactive states:', error);
    }
  }

  // Check for solid style - require more evidence than just a background
  if (buttonStyle.type === 'solid' || buttonStyle.type === 'mixed') {
    // Check for rounded corners which are common in buttons
    if ('cornerRadius' in node) {
      let radius: number;
      if (typeof node.cornerRadius === 'number') {
        radius = node.cornerRadius;
      } else if (Array.isArray(node.cornerRadius)) {
        radius = Math.max(...node.cornerRadius);
      } else {
        radius = 0;
      }
      
      if (radius > 0) {
        if (config.commonRadii.includes(radius)) {
          score += 2;
          reasons.push('Has common button radius');
        } else {
          score += 1;
          reasons.push('Has rounded corners');
        }
      } else {
        // Lower score for non-rounded buttons
        score += 1;
        reasons.push(`Has ${buttonStyle.type} background`);
      }
    }
  }

  // Check for corner radius
  if ('cornerRadius' in node) {
    let radius: number;
    if (typeof node.cornerRadius === 'number') {
      radius = node.cornerRadius;
    } else if (Array.isArray(node.cornerRadius)) {
      radius = Math.max(...node.cornerRadius);
    } else {
      radius = 0;
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
  let hasActionWord = false;
  let exactMatch = false;

  for (const textNode of textNodes) {
    if ('characters' in textNode) {
      const text = textNode.characters.toLowerCase().trim();
      
      // Exact match with action word
      if (config.commonActionWords.includes(text)) {
        exactMatch = true;
        break;
      }

      // Contains action word
      if (config.commonActionWords.some(word => text.includes(word))) {
        hasActionWord = true;
      }
    }
  }

  if (exactMatch) {
    return { score: 2, reason: 'Contains exact action word' };
  }

  if (hasActionWord) {
    return { score: 1, reason: 'Contains action word' };
  }

  return { score: 0 };
}
