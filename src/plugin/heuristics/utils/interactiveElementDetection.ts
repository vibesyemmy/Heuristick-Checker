import { ButtonDetectionConfig } from '../config/buttonDetection';
import { detectNodeRole } from './aiDetection';

export enum InteractiveElementType {
  BUTTON = 'button',
  LINK = 'link',
  NONE = 'none'
}

export interface InteractiveElementResult {
  type: InteractiveElementType;
  score: number;
  reasons: string[];
  debugInfo?: {
    namingScore: number;
    structureScore: number;
    styleScore: number;
    variantScore: number;
    contextScore: number;
  };
}

interface TextStyle {
  textDecoration?: string;
  color?: RGB;
  fontFamily?: string;
  fontSize?: number;
}

// Helper function to extract text style from a node
function getTextStyle(node: SceneNode): TextStyle | null {
  if (node.type === 'TEXT') {
    const style: TextStyle = {};
    
    // Handle text decoration
    if (node.textDecoration !== figma.mixed) {
      style.textDecoration = node.textDecoration;
    }
    
    // Handle color from fills
    if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID') {
        style.color = fill.color;
      }
    }
    
    // Handle font family
    if (node.fontName !== figma.mixed) {
      style.fontFamily = node.fontName.family;
    }
    
    // Handle font size
    if (node.fontSize !== figma.mixed) {
      style.fontSize = node.fontSize;
    }
    
    return style;
  }
  return null;
}

// Helper to check if a node is a simple text group (just text and maybe an underline)
function isSimpleTextGroup(node: SceneNode): boolean {
  if (node.type !== 'GROUP' && node.type !== 'FRAME') return false;
  if (!('children' in node)) return false;
  
  const children = node.children;
  if (children.length > 2) return false;
  
  const hasText = children.some(child => child.type === 'TEXT');
  const hasOnlyTextAndLine = children.every(child => 
    child.type === 'TEXT' || 
    (child.type === 'LINE' && child.name.toLowerCase().includes('underline'))
  );
  
  return hasText && hasOnlyTextAndLine;
}

// Helper to check for interactive variants
function hasInteractiveVariants(node: SceneNode): boolean {
  if (node.type !== 'INSTANCE') return false;
  
  const variantProps = 'componentProperties' in node ? Object.keys(node.componentProperties) : [];
  const stateProps = variantProps.filter(prop => 
    prop.toLowerCase().includes('hover') || 
    prop.toLowerCase().includes('pressed') || 
    prop.toLowerCase().includes('focus')
  );
  
  return stateProps.length > 0;
}

// Helper to check if colors are similar
function compareColors(color1?: RGB, color2?: RGB): number {
  if (!color1 || !color2) return 1;
  
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Main detection function
export async function detectInteractiveElement(
  node: SceneNode,
  config: ButtonDetectionConfig,
  debugLevel: number = 0
): Promise<InteractiveElementResult> {
  // First check if it's a link
  const linkResult = detectLink(node);
  if (linkResult.type === InteractiveElementType.LINK) {
    return linkResult;
  }
  
  // If not a link, check if it's a button
  const buttonResult = await detectButton(node, config, debugLevel);
  return buttonResult;
}

function detectLink(node: SceneNode): InteractiveElementResult {
  let score = 0;
  const reasons: string[] = [];
  
  // Check if it's a text node or simple text group
  if (node.type !== 'TEXT' && !isSimpleTextGroup(node)) {
    return {
      type: InteractiveElementType.NONE,
      score: 0,
      reasons: ['Not a text node or simple text group']
    };
  }
  
  // Check text styling
  const textStyle = getTextStyle(node);
  if (textStyle) {
    if (textStyle.textDecoration === 'UNDERLINE') {
      score += 3;
      reasons.push('Has underline decoration');
    }
    
    // TODO: Compare with design system link colors
    // if (compareColors(textStyle.color, designSystem.linkColor) < 0.1) {
    //   score += 2;
    //   reasons.push('Uses link color from design system');
    // }
  }
  
  // Check naming patterns
  const name = node.name.toLowerCase();
  if (name.includes('link') || name.endsWith('link')) {
    score += 2;
    reasons.push('Name indicates link');
  }
  
  // Check for common link text patterns
  if (node.type === 'TEXT') {
    const text = node.characters.toLowerCase();
    if (text.includes('http') || text.includes('www') || text.includes('.com')) {
      score += 2;
      reasons.push('Contains URL-like text');
    }
    
    const linkWords = ['read more', 'learn more', 'click here', 'view all'];
    if (linkWords.some(word => text.includes(word))) {
      score += 1;
      reasons.push('Contains common link text');
    }
  }
  
  // Check parent context
  if (node.parent) {
    const parentName = node.parent.name.toLowerCase();
    if (parentName.includes('nav') || 
        parentName.includes('menu') || 
        parentName.includes('footer')) {
      score += 2;
      reasons.push('Located in navigation context');
    }
  }
  
  return {
    type: score >= 5 ? InteractiveElementType.LINK : InteractiveElementType.NONE,
    score,
    reasons
  };
}

async function detectButton(
  node: SceneNode,
  config: ButtonDetectionConfig,
  debugLevel: number
): Promise<InteractiveElementResult> {
  let score = 0;
  const reasons: string[] = [];
  const debugInfo = {
    namingScore: 0,
    structureScore: 0,
    styleScore: 0,
    variantScore: 0,
    contextScore: 0,
    aiScore: 0
  };

  // First, try AI detection
  const aiResult = await detectNodeRole(node);
  if (aiResult.role === 'button' || aiResult.semanticType === 'button') {
    const aiBonus = Math.floor(aiResult.confidence * 10); // Convert confidence to score (0-10)
    score += aiBonus;
    reasons.push(`AI detected as button (confidence: ${(aiResult.confidence * 100).toFixed(1)}%)`);
    debugInfo.aiScore += aiBonus;
  }

  // Check if it's an instance of a known button component
  if (node.type === 'INSTANCE') {
    try {
      const mainComponent = await node.getMainComponentAsync();
      if (mainComponent) {
        const mainComponentName = mainComponent.name.toLowerCase();
        if (mainComponentName.includes('button')) {
          score += 5;
          reasons.push('Instance of button component');
          debugInfo.namingScore += 5;
        }
      }
    } catch (error) {
      console.log('Could not access main component:', error);
    }
  }

  // Check naming patterns
  const name = node.name.toLowerCase();
  const buttonPatterns = config.namingPatterns;
  for (const pattern of buttonPatterns) {
    if (new RegExp(pattern, 'i').test(name)) {
      score += 2; // Reduced from 3 since we now have AI
      reasons.push(`Matches button naming pattern: ${pattern}`);
      debugInfo.namingScore += 2;
      break;
    }
  }

  // Check for interactive variants
  if (hasInteractiveVariants(node)) {
    score += 3; // Reduced from 4 since we now have AI
    reasons.push('Has interactive state variants');
    debugInfo.variantScore += 3;
  }

  // Check structure
  if ('children' in node) {
    const children = node.children;
    const textNodes = children.filter(child => child.type === 'TEXT');
    const iconNodes = children.filter(child => 
      child.type === 'VECTOR' || 
      (child.type === 'INSTANCE' && child.name.toLowerCase().includes('icon'))
    );

    if (textNodes.length === 1 && iconNodes.length <= 1) {
      score += 2; // Reduced from 3 since we now have AI
      reasons.push('Has standard button structure (text + optional icon)');
      debugInfo.structureScore += 2;
    }
  }

  // Check dimensions
  if ('width' in node && 'height' in node) {
    const { width, height } = node;
    const { dimensionRanges } = config;

    if (height >= dimensionRanges.minHeight && 
        height <= dimensionRanges.maxHeight && 
        width >= dimensionRanges.minWidth && 
        width <= dimensionRanges.maxWidth) {
      score += 2;
      reasons.push('Dimensions match button standards');
      debugInfo.styleScore += 2;
    }
  }

  // Check for common action words in text content
  if ('children' in node) {
    const textContent = node.children
      .filter(child => child.type === 'TEXT')
      .map(child => (child as TextNode).characters.toLowerCase())
      .join(' ');

    const actionWords = config.commonActionWords;
    const hasActionWord = actionWords.some(word => textContent.includes(word));

    if (hasActionWord) {
      score += 2;
      reasons.push('Contains action word');
      debugInfo.contextScore += 2;
    }
  }

  // Adjust minimum score based on AI confidence
  const effectiveMinScore = aiResult.confidence > 0.8 ? 
    Math.max(config.minScore - 5, 5) : // Lower threshold if AI is very confident
    config.minScore;

  return {
    type: score >= effectiveMinScore ? InteractiveElementType.BUTTON : InteractiveElementType.NONE,
    score,
    reasons,
    debugInfo
  };
}
