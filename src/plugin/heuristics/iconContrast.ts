import Color from 'color';

// Types and interfaces
type IconRole = 'interactive' | 'informative' | 'decorative';

interface IconDetectionConfig {
  maxSize: number;
  namePatterns: string[];
  roleOverrides: Map<string, IconRole>;
  contrastThresholds: Record<IconRole, number>;
  maxAspectRatioDifference: number;  // Maximum allowed difference between width and height ratio
}

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface ColorWithOpacity {
  color: FigmaColor;
  fillOpacity: number;
  layerOpacity: number;
}

interface IconAnalysisResult {
  nodeId: string;
  nodeName: string;
  role: IconRole;
  colors: {
    original: FigmaColor;
    blended: FigmaColor;
    contrastRatio: number;
  }[];
  backgroundColor: FigmaColor;
  contrastRatio: number;
  requiredRatio: number;
  isCompliant: boolean;
  failingColors?: FigmaColor[];
}

// Configuration
const defaultConfig: IconDetectionConfig = {
  maxSize: 48,
  namePatterns: [
    'icon',
    'ico',
    'glyph',
    'symbol',
    'logo',
    'avatar',
    'bullet',
    'marker',
    'indicator'
  ],
  roleOverrides: new Map(),
  contrastThresholds: {
    interactive: 4.5,  // WCAG AA for interactive elements
    informative: 3.0,  // WCAG AA for non-text content
    decorative: 2.0   // Lower threshold for decorative elements
  },
  maxAspectRatioDifference: 0.2  // This means width/height should be between 0.8 and 1.2
};

// Cache for performance
const iconCache = new WeakMap<SceneNode, boolean>();
const roleCache = new WeakMap<SceneNode, IconRole>();
const backgroundCache = new WeakMap<SceneNode, ColorWithOpacity>();

// Icon detection
function isIconNode(node: SceneNode, config = defaultConfig): boolean {
  if (iconCache.has(node)) {
    return iconCache.get(node)!;
  }

  // Skip hidden nodes
  if ('visible' in node && !node.visible) {
    iconCache.set(node, false);
    return false;
  }

  const nameMatch = isIconByName(node, config);
  const typeMatch = isIconByType(node);
  const sizeMatch = isIconBySize(node, config);
  const shapeMatch = isIconByShape(node, config);
  const contextMatch = isIconByContext(node);

  // Require at least two criteria to match, or name match plus one other
  const result = (nameMatch && (typeMatch || sizeMatch || shapeMatch || contextMatch)) ||
                (typeMatch && sizeMatch && shapeMatch);
  
  iconCache.set(node, result);
  return result;
}

function isIconByName(node: SceneNode, config: IconDetectionConfig): boolean {
  const name = node.name.toLowerCase();
  return config.namePatterns.some(pattern => name.includes(pattern));
}

function isIconByType(node: SceneNode): boolean {
  return ['VECTOR', 'FRAME', 'COMPONENT', 'INSTANCE', 'ELLIPSE', 'STAR', 'RECTANGLE'].includes(node.type);
}

function isIconBySize(node: SceneNode, config: IconDetectionConfig): boolean {
  return node.width <= config.maxSize && node.height <= config.maxSize;
}

function isIconByShape(node: SceneNode, config: IconDetectionConfig): boolean {
  if (!('width' in node) || !('height' in node)) {
    return false;
  }

  // Skip nodes that are too small
  if (node.width < 12 || node.height < 12) {
    return false;
  }

  // Calculate aspect ratio
  const aspectRatio = node.width / node.height;
  
  // Check if the aspect ratio is close to 1:1
  return Math.abs(1 - aspectRatio) <= config.maxAspectRatioDifference;
}

function isIconByContext(node: SceneNode): boolean {
  // Skip hidden nodes or nodes with hidden parents
  let current: BaseNode | null = node;
  while (current) {
    if ('visible' in current && !current.visible) {
      return false;
    }
    current = current.parent;
  }

  const parent = node.parent;
  if (!parent) return false;

  // Check if it's inside a button or clickable component
  const parentName = parent.name.toLowerCase();
  return parentName.includes('button') || 
         parentName.includes('icon') || 
         ('onClick' in parent) ||
         ('reactions' in parent && (parent as any).reactions?.length > 0);
}

// Role determination
function determineIconRole(node: SceneNode, config = defaultConfig): IconRole {
  if (roleCache.has(node)) {
    return roleCache.get(node)!;
  }

  let role: IconRole;
  
  if (config.roleOverrides.has(node.name)) {
    role = config.roleOverrides.get(node.name)!;
  } else if (isInteractive(node)) {
    role = 'interactive';
  } else if (isDecorative(node)) {
    role = 'decorative';
  } else {
    role = 'informative';
  }

  roleCache.set(node, role);
  return role;
}

function isInteractive(node: SceneNode): boolean {
  if (!node.parent) return false;
  
  const parentName = node.parent.name.toLowerCase();
  return parentName.includes('button') || 
         parentName.includes('btn') || 
         parentName.includes('link') ||
         parentName.includes('clickable');
}

function isDecorative(node: SceneNode): boolean {
  const name = node.name.toLowerCase();
  return name.includes('decorative') || 
         name.includes('background');
}

// Background detection
function getCanvasBackground(): ColorWithOpacity {
  // Get the page node first, as it has the backgrounds property
  const page = figma.currentPage;
  const backgrounds = page.backgrounds;
  
  // Check if backgrounds exist and are not mixed
  if (backgrounds) {
    const visibleBackgrounds = backgrounds.filter((bg: Paint) => bg.visible !== false);
    if (visibleBackgrounds.length > 0) {
      const bg = visibleBackgrounds[0];
      if (bg.type === 'SOLID') {
        return {
          color: bg.color,
          fillOpacity: bg.opacity ?? 1,
          layerOpacity: 1
        };
      }
    }
  }
  
  // If no canvas background is set or it's not a solid color,
  // return white as the absolute fallback
  return {
    color: { r: 1, g: 1, b: 1 },
    fillOpacity: 1,
    layerOpacity: 1
  };
}

function findEffectiveBackground(node: SceneNode): ColorWithOpacity {
  let current: BaseNode | null = node;
  const backgroundLayers: ColorWithOpacity[] = [];

  while (current && current.type !== 'PAGE') {
    if ('fills' in current) {
      const fills = current.fills as Paint[];
      if (Array.isArray(fills)) {
        for (const fill of fills) {
          if (fill.type === 'SOLID' && fill.visible !== false) {
            backgroundLayers.unshift({
              color: fill.color,
              fillOpacity: fill.opacity ?? 1,
              layerOpacity: ('opacity' in current) ? (current.opacity ?? 1) : 1
            });
          }
        }
      }
    }
    
    if ('backgrounds' in current) {
      const backgrounds = current.backgrounds as Paint[];
      if (Array.isArray(backgrounds)) {
        for (const bg of backgrounds) {
          if (bg.type === 'SOLID' && bg.visible !== false) {
            backgroundLayers.unshift({
              color: bg.color,
              fillOpacity: bg.opacity ?? 1,
              layerOpacity: 1
            });
          }
        }
      }
    }
    
    current = current.parent;
  }

  // If no opaque background was found, use the canvas background
  if (backgroundLayers.length === 0) {
    return getCanvasBackground();
  }

  // Blend all background layers
  return backgroundLayers.reduce((acc, layer) => blendColorWithOpacity(layer, acc));
}

// Color utilities
function blendColorWithOpacity(top: ColorWithOpacity, bottom: ColorWithOpacity): ColorWithOpacity {
  // Calculate effective opacity considering both fill and layer opacity
  const topEffectiveOpacity = top.fillOpacity * top.layerOpacity;
  const bottomEffectiveOpacity = bottom.fillOpacity * bottom.layerOpacity;
  
  // If both layers are fully transparent, return transparent color
  if (topEffectiveOpacity === 0 && bottomEffectiveOpacity === 0) {
    return {
      color: { r: 0, g: 0, b: 0, a: 0 },
      fillOpacity: 0,
      layerOpacity: 0
    };
  }
  
  // Blend colors using alpha compositing formula
  const resultOpacity = topEffectiveOpacity + bottomEffectiveOpacity * (1 - topEffectiveOpacity);
  
  // Helper function to blend a single color channel
  const blendChannel = (a: number, b: number): number => {
    if (resultOpacity === 0) return 0;
    return (a * topEffectiveOpacity + b * bottomEffectiveOpacity * (1 - topEffectiveOpacity)) / resultOpacity;
  };
  
  return {
    color: {
      r: blendChannel(top.color.r, bottom.color.r),
      g: blendChannel(top.color.g, bottom.color.g),
      b: blendChannel(top.color.b, bottom.color.b),
      a: resultOpacity
    },
    fillOpacity: resultOpacity,
    layerOpacity: 1 // The blended color now has the opacity baked in
  };
}

function colorWithOpacityToHex(color: ColorWithOpacity): string {
  const { r, g, b } = color.color;
  const effectiveOpacity = color.fillOpacity * color.layerOpacity;
  
  return Color.rgb(
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
    effectiveOpacity
  ).hex();
}

// Contrast calculation
function calculateContrastRatio(foreground: ColorWithOpacity, background: ColorWithOpacity): number {
  // First blend the colors with their respective opacities
  const blendedFg = blendColorWithOpacity(foreground, background);
  
  // Convert to hex for luminosity calculation
  const fgHex = colorWithOpacityToHex(blendedFg);
  const bgHex = colorWithOpacityToHex(background);
  
  const fgColor = Color(fgHex);
  const bgColor = Color(bgHex);
  
  // Calculate luminance considering opacity
  const fgLuminance = fgColor.luminosity() * (blendedFg.fillOpacity * blendedFg.layerOpacity);
  const bgLuminance = bgColor.luminosity() * (background.fillOpacity * background.layerOpacity);
  
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  
  // If both elements are completely transparent, return 1 (no contrast)
  if (lighter === 0 && darker === 0) return 1;
  
  return (lighter + 0.05) / (darker + 0.05);
}

// Main analysis function
function analyzeIconContrast(node: SceneNode, config = defaultConfig): IconAnalysisResult | null {
  // Skip if not an icon or if hidden
  if (!isIconNode(node, config) || ('visible' in node && !node.visible)) {
    return null;
  }

  console.log(`\nAnalyzing icon contrast for "${node.name}":`);
  
  const role = determineIconRole(node, config);
  console.log(`- Determined role: ${role}`);
  
  const background = findEffectiveBackground(node);
  console.log(`- Background color: rgb(${Math.round(background.color.r * 255)}, ${Math.round(background.color.g * 255)}, ${Math.round(background.color.b * 255)})`);
  
  const iconColors = extractIconColorsWithOpacity(node);
  console.log(`- Found ${iconColors.length} colors in icon`);
  
  const contrastResults = iconColors.map(color => {
    const ratio = calculateContrastRatio(color, background);
    console.log(`- Color rgb(${Math.round(color.color.r * 255)}, ${Math.round(color.color.g * 255)}, ${Math.round(color.color.b * 255)}) has contrast ratio: ${ratio.toFixed(2)}:1`);
    return {
      original: color.color,
      blended: blendColorWithOpacity(color, background).color,
      contrastRatio: ratio
    };
  });
  
  const lowestContrast = Math.min(...contrastResults.map(r => r.contrastRatio));
  const requiredRatio = config.contrastThresholds[role];
  const isCompliant = lowestContrast >= requiredRatio;
  
  console.log(`- Lowest contrast: ${lowestContrast.toFixed(2)}:1`);
  console.log(`- Required contrast: ${requiredRatio}:1`);
  console.log(`- Compliance: ${isCompliant ? 'PASS' : 'FAIL'}\n`);
  
  return {
    nodeId: node.id,
    nodeName: node.name,
    role,
    colors: contrastResults,
    backgroundColor: background.color,
    contrastRatio: lowestContrast,
    requiredRatio,
    isCompliant,
    failingColors: isCompliant ? undefined : contrastResults
      .filter(r => r.contrastRatio < requiredRatio)
      .map(r => r.original)
  };
}

function extractIconColorsWithOpacity(node: SceneNode, parentOpacity: number = 1): ColorWithOpacity[] {
  const colors: ColorWithOpacity[] = [];
  const nodeOpacity = 'opacity' in node ? (node.opacity || 1) : 1;
  const effectiveOpacity = nodeOpacity * parentOpacity;  // Multiply with parent's opacity

  // Helper function to add a color with proper opacity
  function addColor(paint: Paint, layerOpacity: number) {
    if (paint.type === 'SOLID' && paint.visible) {
      colors.push({
        color: {
          r: paint.color.r,
          g: paint.color.g,
          b: paint.color.b,
          a: paint.opacity
        },
        fillOpacity: paint.opacity || 1,
        layerOpacity  // Use the cascaded opacity
      });
    } else if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL' || paint.type === 'GRADIENT_ANGULAR') {
      // For gradients, add each stop color
      paint.gradientStops.forEach(stop => {
        colors.push({
          color: {
            r: stop.color.r,
            g: stop.color.g,
            b: stop.color.b,
            a: stop.color.a
          },
          fillOpacity: stop.color.a || 1,
          layerOpacity  // Use the cascaded opacity
        });
      });
    }
  }

  // Check for fills
  if ('fills' in node) {
    const fills = node.fills as Paint[];
    if (Array.isArray(fills)) {
      fills.forEach(fill => addColor(fill, effectiveOpacity));
    }
  }

  // Check for strokes
  if ('strokes' in node) {
    const strokes = node.strokes as Paint[];
    if (Array.isArray(strokes)) {
      strokes.forEach(stroke => addColor(stroke, effectiveOpacity));
    }
  }

  // Check for backgrounds (auto-layout frames)
  if ('backgrounds' in node) {
    const backgrounds = (node as FrameNode).backgrounds;
    if (Array.isArray(backgrounds)) {
      backgrounds.forEach(bg => addColor(bg, effectiveOpacity));
    }
  }

  // Check for effects that might affect color
  if ('effects' in node) {
    const effects = node.effects;
    if (Array.isArray(effects)) {
      effects.forEach(effect => {
        if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
          colors.push({
            color: {
              r: effect.color.r,
              g: effect.color.g,
              b: effect.color.b,
              a: effect.color.a || 1
            },
            fillOpacity: effect.color.a || 1,
            layerOpacity: effectiveOpacity * (effect.spread || 1)  // Include spread in opacity calculation
          });
        }
      });
    }
  }

  // For vector nodes, check path fills
  if (node.type === 'VECTOR') {
    const vectorNode = node as VectorNode;
    if (vectorNode.vectorNetwork && vectorNode.vectorNetwork.regions) {
      vectorNode.vectorNetwork.regions.forEach(region => {
        if (region.fills) {
          region.fills.forEach(fill => addColor(fill, effectiveOpacity));
        }
      });
    }
  }

  // For component instances, check for style overrides
  if (node.type === 'INSTANCE') {
    const instance = node as InstanceNode;
    // Get fills and strokes directly from the instance
    if (instance.fills) {
      (instance.fills as Paint[]).forEach(fill => addColor(fill, effectiveOpacity));
    }
    if (instance.strokes) {
      (instance.strokes as Paint[]).forEach(stroke => addColor(stroke, effectiveOpacity));
    }
  }

  // Recursively check children with cascaded opacity
  if ('children' in node) {
    for (const child of node.children) {
      colors.push(...extractIconColorsWithOpacity(child, effectiveOpacity));
    }
  }

  // Remove duplicates and invalid colors
  return colors.filter((color, index, self) => 
    // Remove invalid colors
    color.color.r >= 0 && color.color.r <= 1 &&
    color.color.g >= 0 && color.color.g <= 1 &&
    color.color.b >= 0 && color.color.b <= 1 &&
    // Remove duplicates
    index === self.findIndex(c => 
      c.color.r === color.color.r &&
      c.color.g === color.color.g &&
      c.color.b === color.color.b &&
      c.fillOpacity === color.fillOpacity &&
      c.layerOpacity === color.layerOpacity
    )
  );
}

function generateIconRecommendations(
  contrastRatio: number,
  requiredRatio: number,
  role: IconRole,
  colors: { original: FigmaColor; blended: FigmaColor; contrastRatio: number }[],
  backgroundColor: FigmaColor
): string[] {
  const recommendations: string[] = [];
  
  if (contrastRatio < requiredRatio) {
    // First recommendation: Always show the contrast improvement needed
    recommendations.push(
      `Increase contrast ratio from ${contrastRatio.toFixed(2)}:1 to at least ${requiredRatio}:1`
    );

    // Second recommendation: Color-specific fix based on background
    const bgLuminance = Color.rgb(
      Math.round(backgroundColor.r * 255),
      Math.round(backgroundColor.g * 255),
      Math.round(backgroundColor.b * 255)
    ).luminosity();

    recommendations.push(
      bgLuminance > 0.5
        ? 'Use darker, more saturated colors against the light background'
        : 'Use lighter, more saturated colors against the dark background'
    );

    // Third recommendation: Role-specific advice
    switch (role) {
      case 'interactive':
        recommendations.push('Add a visible boundary or background shape to improve visibility');
        break;
      case 'informative':
        recommendations.push('Consider adding a text label for clarity');
        break;
      case 'decorative':
        recommendations.push('Simplify the design or reclassify if it conveys meaning');
        break;
    }
  }
  
  return recommendations;
}

// Export both the main function and testing utilities
export { 
  analyzeIconContrast as evaluateIconContrast,
  generateIconRecommendations 
};
export const __testing = {
  isIconNode,
  determineIconRole,
  findEffectiveBackground,
  calculateContrastRatio,
  extractIconColorsWithOpacity,
  generateIconRecommendations
};
