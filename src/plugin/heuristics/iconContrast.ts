// Types and interfaces
type IconRole = 'interactive' | 'informative' | 'decorative';

interface IconDetectionConfig {
  maxSize: number;
  namePatterns: string[];
  roleOverrides: Map<string, IconRole>;
  contrastThresholds: Record<IconRole, number>;
}

interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface IconAnalysisResult {
  nodeId: string;
  nodeName: string;
  role: IconRole;
  colors: {
    original: Color;
    blended: Color;
    contrastRatio: number;
  }[];
  backgroundColor: Color;
  contrastRatio: number;
  requiredRatio: number;
  isCompliant: boolean;
  failingColors?: Color[];
}

// Configuration
const defaultConfig: IconDetectionConfig = {
  maxSize: 48,
  namePatterns: ['icon', 'ico', 'info', 'i', 'delete', 'add', 'close', 'menu'],
  roleOverrides: new Map(),
  contrastThresholds: {
    interactive: 3.0,
    informative: 3.0,
    decorative: 2.0
  }
};

// Cache for performance
const iconCache = new WeakMap<SceneNode, boolean>();
const roleCache = new WeakMap<SceneNode, IconRole>();
const backgroundCache = new WeakMap<SceneNode, Color>();

// Icon detection
function isIconNode(node: SceneNode, config = defaultConfig): boolean {
  if (iconCache.has(node)) {
    return iconCache.get(node)!;
  }

  console.log(`Checking if node "${node.name}" is an icon:`);
  console.log(`- Type: ${node.type}`);
  console.log(`- Size: ${node.width}x${node.height}`);
  console.log(`- Parent: ${node.parent?.type || 'none'}`);

  const nameMatch = isIconByName(node, config);
  const typeMatch = isIconByType(node);
  const sizeMatch = isIconBySize(node, config);
  const contextMatch = isIconByContext(node);

  console.log(`- Name match: ${nameMatch}`);
  console.log(`- Type match: ${typeMatch}`);
  console.log(`- Size match: ${sizeMatch}`);
  console.log(`- Context match: ${contextMatch}`);

  const result = nameMatch || typeMatch || sizeMatch || contextMatch;
  iconCache.set(node, result);
  console.log(`Final result: node "${node.name}" ${result ? 'is' : 'is not'} an icon`);
  return result;
}

function isIconByName(node: SceneNode, config: IconDetectionConfig): boolean {
  const name = node.name.toLowerCase();
  const matches = config.namePatterns.filter(pattern => name.includes(pattern));
  if (matches.length > 0) {
    console.log(`Name "${name}" matches patterns: ${matches.join(', ')}`);
  }
  return matches.length > 0;
}

function isIconByType(node: SceneNode): boolean {
  const validTypes = ['VECTOR', 'FRAME', 'COMPONENT', 'INSTANCE', 'ELLIPSE', 'STAR', 'RECTANGLE'];
  const isValid = validTypes.includes(node.type);
  if (isValid) {
    console.log(`Type "${node.type}" is a valid icon type`);
  }
  return isValid;
}

function isIconBySize(node: SceneNode, config: IconDetectionConfig): boolean {
  const isValidSize = node.width <= config.maxSize && node.height <= config.maxSize;
  if (isValidSize) {
    console.log(`Size ${node.width}x${node.height} is within max size ${config.maxSize}`);
  }
  return isValidSize;
}

function isIconByContext(node: SceneNode): boolean {
  // Check if the node is inside an interactive component
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'INSTANCE' || 
        parent.name.toLowerCase().includes('button') ||
        parent.name.toLowerCase().includes('link')) {
      console.log(`Found interactive parent: ${parent.type} "${parent.name}"`);
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

// Role determination
function determineIconRole(node: SceneNode, config = defaultConfig): IconRole {
  if (roleCache.has(node)) {
    return roleCache.get(node)!;
  }

  let role: IconRole;

  // Check for manual override
  if (config.roleOverrides.has(node.name)) {
    role = config.roleOverrides.get(node.name)!;
  } else {
    // Automatic detection
    if (isInteractive(node)) {
      role = 'interactive';
    } else if (isDecorative(node)) {
      role = 'decorative';
    } else {
      role = 'informative';
    }
  }

  roleCache.set(node, role);
  console.log(`Icon "${node.name}" determined to be ${role}`);
  return role;
}

function isInteractive(node: SceneNode): boolean {
  const parent = node.parent;
  if (!parent) return false;

  const parentName = parent.name.toLowerCase();
  return parentName.includes('button') || 
         parentName.includes('link') ||
         parentName.includes('menu') ||
         parentName.includes('nav');
}

function isDecorative(node: SceneNode): boolean {
  const name = node.name.toLowerCase();
  return name.includes('decorative') || 
         name.includes('background') ||
         name.startsWith('bg-');
}

// Background detection
function findEffectiveBackground(node: SceneNode): Color {
  if (backgroundCache.has(node)) {
    return backgroundCache.get(node)!;
  }

  try {
    let background: Color = { r: 1, g: 1, b: 1 };

    if ('fills' in node && Array.isArray(node.fills)) {
      const solidFills = node.fills.filter((fill: Paint) => 
        fill.type === 'SOLID' && fill.visible !== false
      );
      if (solidFills.length > 0) {
        return solidFills[0].type === 'SOLID' ? 
          { r: solidFills[0].color.r, g: solidFills[0].color.g, b: solidFills[0].color.b, a: solidFills[0].opacity } :
          background;
      }
    }

    let parent = node.parent;
    while (parent) {
      if ('fills' in parent && Array.isArray(parent.fills)) {
        const solidFills = parent.fills.filter((fill: Paint) => 
          fill.type === 'SOLID' && fill.visible !== false
        );

        if (solidFills.length > 0) {
          const fill = solidFills[solidFills.length - 1] as SolidPaint;
          background = blendColors(
            { r: fill.color.r, g: fill.color.g, b: fill.color.b, a: fill.opacity || 1 },
            background
          );
          
          if (fill.opacity === 1) break; // Found opaque background
        }
      }
      parent = parent.parent;
    }

    backgroundCache.set(node, background);
    console.log(`Background color for "${node.name}":`, background);
    return background;
  } catch (error) {
    console.error(`Error finding background for "${node.name}":`, error);
    return { r: 1, g: 1, b: 1 }; // Fallback to white
  }
}

// Color utilities
function blendColors(top: Color, bottom: Color): Color {
  const a = top.a ?? 1;
  return {
    r: (top.r * a) + (bottom.r * (1 - a)),
    g: (top.g * a) + (bottom.g * (1 - a)),
    b: (top.b * a) + (bottom.b * (1 - a))
  };
}

// Contrast calculation
function calculateContrastRatio(foreground: Color, background: Color): number {
  const fgLuminance = getRelativeLuminance(foreground);
  const bgLuminance = getRelativeLuminance(background);
  
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  
  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance(color: Color): number {
  const toLinear = (c: number) => 
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(color.r) +
         0.7152 * toLinear(color.g) +
         0.0722 * toLinear(color.b);
}

// Main analysis function
export function analyzeIconContrast(node: SceneNode, config = defaultConfig): IconAnalysisResult | null {
  try {
    if (!isIconNode(node, config)) {
      return null;
    }

    const role = determineIconRole(node, config);
    const backgroundColor = findEffectiveBackground(node);
    const iconColors = extractIconColors(node);
    
    if (iconColors.length === 0) {
      console.warn(`No colors found for icon "${node.name}"`);
      return null;
    }

    const contrastRatios = iconColors.map(color => 
      calculateContrastRatio(color, backgroundColor)
    );

    const lowestContrast = Math.min(...contrastRatios);
    const requiredContrast = config.contrastThresholds[role];
    
    return {
      nodeId: node.id,
      nodeName: node.name,
      role,
      colors: iconColors.map(color => ({
        original: color,
        blended: blendColors(color, backgroundColor),
        contrastRatio: calculateContrastRatio(color, backgroundColor)
      })),
      backgroundColor,
      contrastRatio: lowestContrast,
      requiredRatio: requiredContrast,
      isCompliant: lowestContrast >= requiredContrast,
      failingColors: lowestContrast < requiredContrast ? iconColors : undefined
    };

  } catch (error) {
    console.error(`Error analyzing icon "${node.name}":`, error);
    return null;
  }
}

function extractIconColors(node: SceneNode): Color[] {
  const colors: Color[] = [];

  if ('fills' in node && Array.isArray(node.fills)) {
    node.fills.forEach((fill: Paint) => {
      if (fill.type === 'SOLID' && fill.visible !== false) {
        colors.push({
          r: fill.color.r,
          g: fill.color.g,
          b: fill.color.b,
          a: fill.opacity
        });
      }
    });
  }

  if ('strokes' in node && Array.isArray(node.strokes)) {
    node.strokes.forEach((stroke: Paint) => {
      if (stroke.type === 'SOLID' && stroke.visible !== false) {
        colors.push({
          r: stroke.color.r,
          g: stroke.color.g,
          b: stroke.color.b,
          a: stroke.opacity
        });
      }
    });
  }

  // Recursively check children
  if ('children' in node) {
    node.children.forEach(child => {
      colors.push(...extractIconColors(child));
    });
  }

  return colors;
}

// Export both the main function and testing utilities
export { analyzeIconContrast as evaluateIconContrast };
export const __testing = {
  isIconNode,
  determineIconRole,
  findEffectiveBackground,
  calculateContrastRatio,
  extractIconColors
};
