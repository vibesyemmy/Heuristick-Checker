import { IconDetectionConfig } from './types';

export interface IconDetectionScore {
  nameScore: number;
  typeScore: number;
  sizeScore: number;
  contextScore: number;
  total: number;
}

export async function isIconNode(node: SceneNode): Promise<boolean> {
  // Skip hidden nodes
  if ('visible' in node && !node.visible) {
    return false;
  }

  // Skip text nodes
  if (node.type === 'TEXT') {
    return false;
  }

  // Calculate weighted score
  const score = calculateIconScore(node);
  
  // Require a minimum total score and at least two criteria to match
  return score.total >= 0.4;
}

// Constants for detection
const ICON_PATTERNS = {
  PREFIX: /^(icon|ico|glyph|symbol)-/i,
  STANDALONE: /^(?:icon|ico|glyph|symbol)$/i,
  SUFFIX: /-(?:icon|ico|glyph|symbol)$/i,
  EXCLUDE: /(?:button|btn|interactive|clickable)/i
};

// Constants for shape detection
const SHAPE_CONSTRAINTS = {
  MAX_CORNER_RADIUS: 8, // Icons typically don't have large corner radii
  MIN_VECTOR_POINTS: 2,
  MAX_VECTOR_POINTS: 100 // Complex vectors are less likely to be icons
};

// Size constraints for icon detection
const SIZE_CONSTRAINTS = {
  MIN_DIMENSION: 12,
  MAX_DIMENSION: 64,
  MAX_ASPECT_RATIO: 1.5,
  BUTTON_MIN_WIDTH: 80, // Typical minimum button width
  SCALE_THRESHOLD: 0.8  // How much scaling affects size checks
};

export function isIconByName(node: SceneNode): boolean {
  const name = node.name.toLowerCase();
  
  // Check if the node's name matches our icon patterns
  const isIconName = ICON_PATTERNS.PREFIX.test(name) || 
                    ICON_PATTERNS.STANDALONE.test(name) ||
                    ICON_PATTERNS.SUFFIX.test(name);
  
  // If the name contains button-related terms, it's likely not a standalone icon
  if (ICON_PATTERNS.EXCLUDE.test(name)) {
    return false;
  }
  
  // Check parent context
  if (node.parent && 'name' in node.parent) {
    const parentName = node.parent.name.toLowerCase();
    // If parent is clearly a button, this is likely part of a button
    if (ICON_PATTERNS.EXCLUDE.test(parentName)) {
      return false;
    }
  }
  
  return isIconName;
}

export function isIconByType(node: SceneNode): boolean {
  // Skip if it's likely a button
  if (isLikelyButton(node)) {
    return false;
  }

  // Check basic type
  const isValidType = node.type === 'VECTOR' || 
                     node.type === 'STAR' || 
                     node.type === 'ELLIPSE' || 
                     node.type === 'POLYGON' ||
                     node.type === 'BOOLEAN_OPERATION';

  if (!isValidType) {
    return false;
  }

  // Additional checks for specific types
  if (node.type === 'VECTOR') {
    return isSimpleVector(node);
  }

  return true;
}

// Helper function to check if a vector is simple enough to be an icon
function isSimpleVector(node: VectorNode): boolean {
  try {
    // Check vector complexity
    if ('vectorNetwork' in node) {
      const points = node.vectorNetwork.vertices.length;
      return points >= SHAPE_CONSTRAINTS.MIN_VECTOR_POINTS && 
             points <= SHAPE_CONSTRAINTS.MAX_VECTOR_POINTS;
    }
    return true;
  } catch (error) {
    console.error('Error checking vector complexity:', error);
    return false;
  }
}

// Helper to get effective size accounting for scaling
function getEffectiveSize(node: SceneNode): { width: number, height: number } {
  let width = 0;
  let height = 0;

  if ('width' in node && 'height' in node) {
    width = node.width;
    height = node.height;

    // Account for scaling if present
    if ('scaling' in node && typeof node.scaling === 'number') {
      width *= node.scaling;
      height *= node.scaling;
    }

    // Account for parent scaling
    let parent = node.parent;
    while (parent && 'scaling' in parent && typeof parent.scaling === 'number') {
      width *= parent.scaling;
      height *= parent.scaling;
      parent = parent.parent;
    }
  }

  return { width, height };
}

export function isIconBySize(node: SceneNode): boolean {
  // Skip if it's likely a button
  if (isLikelyButton(node)) {
    return false;
  }

  if ('width' in node && 'height' in node) {
    const { width, height } = getEffectiveSize(node);
    
    // If width is significantly larger than typical icon width, likely a button
    if (width >= SIZE_CONSTRAINTS.BUTTON_MIN_WIDTH) {
      return false;
    }

    const maxDimension = Math.max(width, height);
    const minDimension = Math.min(width, height);
    const aspectRatio = maxDimension / minDimension;

    // Check if dimensions fall within icon constraints
    const isIconSize = maxDimension <= SIZE_CONSTRAINTS.MAX_DIMENSION && 
                      minDimension >= SIZE_CONSTRAINTS.MIN_DIMENSION && 
                      aspectRatio <= SIZE_CONSTRAINTS.MAX_ASPECT_RATIO;

    // If parent is an instance or component, be more lenient with size
    if (node.parent && node.parent.type === 'INSTANCE') {
      return isIconSize || (maxDimension <= SIZE_CONSTRAINTS.MAX_DIMENSION * 1.5);
    }

    return isIconSize;
  }
  
  return false;
}

export async function isIconByContext(node: SceneNode): Promise<boolean> {
  try {
    // If the node is likely a button, it's not a standalone icon
    if (isLikelyButton(node)) {
      return false;
    }

    // Check if node is part of a component
    if ('mainComponent' in node) {
      try {
        const mainComponent = await node.getMainComponentAsync();
        if (mainComponent && ICON_PATTERNS.EXCLUDE.test(mainComponent.name.toLowerCase())) {
          return false;
        }
      } catch (error) {
        console.error('Error getting main component:', error);
      }
    }

    // Check parent hierarchy
    let parent = node.parent;
    while (parent) {
      // If parent is a button or interactive element, this is likely part of that element
      if (isLikelyButton(parent as SceneNode)) {
        return false;
      }

      // Check if parent is a component instance
      if (parent.type === 'INSTANCE') {
        try {
          const mainComponent = await (parent as InstanceNode).getMainComponentAsync();
          if (mainComponent && ICON_PATTERNS.EXCLUDE.test(mainComponent.name.toLowerCase())) {
            return false;
          }
        } catch (error) {
          console.error('Error getting parent main component:', error);
        }
      }

      parent = parent.parent;
    }

    // Check for common icon use cases
    const isInformativeIcon = /error|warning|info|success|status/i.test(node.name);
    const hasIconProperties = hasIconLikeProperties(node);

    return isInformativeIcon || hasIconProperties;
  } catch (error) {
    console.error('Error in isIconByContext:', error);
    return false;
  }
}

// Helper to check if node has icon-like properties
function hasIconLikeProperties(node: SceneNode): boolean {
  // Icons often have specific properties
  if ('fills' in node) {
    // Icons typically have simple fills (single color)
    const fills = node.fills as Paint[];
    if (Array.isArray(fills) && fills.length === 1) {
      const fill = fills[0];
      return fill.type === 'SOLID';
    }
  }

  // Icons rarely have many effects
  if ('effects' in node) {
    const effects = node.effects as Effect[];
    if (Array.isArray(effects) && effects.length >= 3) {
      return false;
    }
  }

  return true;
}

// Helper function to check if a node is likely a button
export function isLikelyButton(node: SceneNode): boolean {
  // Check node name
  if (ICON_PATTERNS.EXCLUDE.test(node.name.toLowerCase())) {
    return true;
  }
  
  // Check for interactive properties
  if ('reactions' in node && node.reactions && node.reactions.length > 0) {
    return true;
  }
  
  if ('onClick' in node && node.onClick) {
    return true;
  }
  
  // Check if it's a common button shape
  if (node.type === 'RECTANGLE' && 'cornerRadius' in node) {
    const radius = node.cornerRadius as number;
    if (radius > 0) {
      return true;
    }
  }
  
  return false;
}

export function calculateIconScore(node: SceneNode): IconDetectionScore {
  const nameScore = isIconByName(node) ? 0.3 : 0;
  const typeScore = isIconByType(node) ? 0.2 : 0;
  const sizeScore = isIconBySize(node) ? 0.2 : 0;
  const contextScore = 0.1;  // Context score is handled separately due to async

  return {
    nameScore,
    typeScore,
    sizeScore,
    contextScore,
    total: nameScore + typeScore + sizeScore + contextScore
  };
}

export function determineIconRole(node: SceneNode): 'interactive' | 'informative' | 'decorative' {
  // Check if icon has interactive properties
  if ('reactions' in node && node.reactions && node.reactions.length > 0) {
    return 'interactive';
  }

  // Check if parent is interactive
  if (node.parent && 'name' in node.parent) {
    const parentName = node.parent.name.toLowerCase();
    if (parentName.includes('button') || parentName.includes('btn') || parentName.includes('link')) {
      return 'interactive';
    }
  }

  // Check if icon is decorative
  const name = node.name.toLowerCase();
  if (name.includes('decorative') || name.includes('background') || name.includes('pattern')) {
    return 'decorative';
  }

  // Default to informative
  return 'informative';
}
