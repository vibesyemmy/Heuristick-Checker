import Color from 'color';
import { getCumulativeOpacity } from './iconContrast';

export interface ContrastIssue {
  nodeId: string;
  nodeName: string;
  textColor: string;
  backgroundColor: string;
  blendedTextColor?: string;  
  fontSize: number;
  isBold: boolean;
  contrastRatio?: number;
  requiredRatio?: number;
  isCompliant?: boolean;
  level?: 'AAA' | 'AA' | 'Fail';
  recommendations?: string[];
  effectiveOpacity?: number;
  hasMixedWeights?: boolean;
  fontWeightSegments?: FontWeightSegment[];
  lowestWeight?: number;
  highestWeight?: number;
  weightAnalysisNote?: string;
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface ColorWithOpacity {
  color: FigmaColor;
  fillOpacity: number;
  layerOpacity: number;
}

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface FontWeightSegment {
  text: string;
  weight: number;
  fontSize: number;
  position: {
    start: number;
    end: number;
  };
}

function alphaBlend(foreground: RGBColor, background: RGBColor, alpha: number): RGBColor {
  return {
    r: alpha * foreground.r + (1 - alpha) * background.r,
    g: alpha * foreground.g + (1 - alpha) * background.g,
    b: alpha * foreground.b + (1 - alpha) * background.b
  };
}

function figmaColorToRGB(color: FigmaColor): RGBColor {
  return {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255)
  };
}

function rgbToHex(color: RGBColor): string {
  return Color.rgb(color.r, color.g, color.b).toString();
}

export function convertFigmaColorToHex(color: ColorWithOpacity, background?: ColorWithOpacity): string {
  const { r, g, b } = color.color;
  const effectiveOpacity = color.fillOpacity * color.layerOpacity;
  
  if (background && effectiveOpacity < 1) {
    // Alpha blend with background
    const { r: bgR, g: bgG, b: bgB } = background.color;
    const bgEffectiveOpacity = background.fillOpacity * background.layerOpacity;
    
    const blendedR = (r * effectiveOpacity) + (bgR * bgEffectiveOpacity * (1 - effectiveOpacity));
    const blendedG = (g * effectiveOpacity) + (bgG * bgEffectiveOpacity * (1 - effectiveOpacity));
    const blendedB = (b * effectiveOpacity) + (bgB * bgEffectiveOpacity * (1 - effectiveOpacity));
    
    return Color.rgb(
      Math.round(blendedR * 255),
      Math.round(blendedG * 255),
      Math.round(blendedB * 255)
    ).hex();
  }
  
  return Color.rgb(
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255)
  ).hex();
}

export function calculateContrastRatio(color1: ColorWithOpacity, color2: ColorWithOpacity): number {
  const c1 = Color(convertFigmaColorToHex(color1));
  const c2 = Color(convertFigmaColorToHex(color2));
  
  const l1 = c1.luminosity();
  const l2 = c2.luminosity();
  
  const lightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  
  return (lightest + 0.05) / (darkest + 0.05);
}

interface BackgroundLayer {
  color: FigmaColor;
  fillOpacity: number;
  layerOpacity: number;
  nodeName: string;  // For debugging
}

function blendColors(foreground: FigmaColor, background: FigmaColor, alpha: number): FigmaColor {
  return {
    r: alpha * foreground.r + (1 - alpha) * background.r,
    g: alpha * foreground.g + (1 - alpha) * background.g,
    b: alpha * foreground.b + (1 - alpha) * background.b
  };
}

function blendBackgroundLayers(layers: BackgroundLayer[]): ColorWithOpacity {
  if (layers.length === 0) {
    return {
      color: { r: 1, g: 1, b: 1 },
      fillOpacity: 1,
      layerOpacity: 1
    };
  }

  // Start with the bottommost layer (canvas or lowest background)
  let result = { ...layers[0].color };
  let currentAlpha = layers[0].fillOpacity * layers[0].layerOpacity;

  // Blend each subsequent layer using the correct alpha compositing formula
  for (let i = 1; i < layers.length; i++) {
    const layer = layers[i];
    const layerAlpha = layer.fillOpacity * layer.layerOpacity;
    
    // Use the alpha blending formula: αFg * Fg + (1 - αFg) * Bg
    result = blendColors(layer.color, result, layerAlpha);

    console.log(`Blending layer ${i}:`, {
      layerName: layer.nodeName,
      layerColor: layer.color,
      layerAlpha,
      currentResult: result
    });
  }

  return {
    color: result,
    fillOpacity: 1,  // The result is now fully opaque
    layerOpacity: 1
  };
}

function getCanvasBackground(): BackgroundLayer {
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
          layerOpacity: 1,
          nodeName: 'Canvas'
        };
      }
    }
  }
  
  // If no canvas background is set or it's not a solid color,
  // return white as the absolute fallback
  return {
    color: { r: 1, g: 1, b: 1 },
    fillOpacity: 1,
    layerOpacity: 1,
    nodeName: 'Default White'
  };
}

function getNodeFillOpacity(fill: Paint): number {
  // If opacity is set in the UI as a percentage (e.g., 10%), 
  // Figma's API will return it as a decimal (0.1)
  return fill.opacity ?? 1;
}

function getNodeLayerOpacity(node: BaseNode & { opacity?: number }): number {
  return node.opacity ?? 1;
}

export function findOpaqueBackground(node: BaseNode): ColorWithOpacity {
  const backgroundLayers: BackgroundLayer[] = [];
  let parent = node.parent;
  let foundOpaqueBackground = false;
  
  while (parent && !foundOpaqueBackground) {
    if ('fills' in parent && parent.fills && parent.fills !== figma.mixed) {
      const fills = (parent.fills as Paint[]).filter(fill => fill.visible !== false);
      
      for (const fill of fills) {
        if (fill.type === 'SOLID') {
          const parentOpacity = getNodeLayerOpacity(parent);
          const fillOpacity = getNodeFillOpacity(fill);
          
          // Add this background layer to our collection
          backgroundLayers.unshift({  // Add to front so bottom-most is first
            color: fill.color,
            fillOpacity: fillOpacity,
            layerOpacity: parentOpacity,
            nodeName: parent.name
          });

          console.log('Found background layer:', {
            name: parent.name,
            color: fill.color,
            fillOpacity: `${(fillOpacity * 100).toFixed(1)}%`,  // Log as percentage for clarity
            layerOpacity: `${(parentOpacity * 100).toFixed(1)}%`
          });

          // Stop if this background is fully opaque
          if (fillOpacity === 1 && parentOpacity === 1) {
            console.log('Found fully opaque background, stopping traversal');
            foundOpaqueBackground = true;
            break;
          }
        }
      }
    }
    parent = parent.parent;
  }

  // If no backgrounds found or we haven't hit an opaque background,
  // add the canvas background as the bottom layer
  if (backgroundLayers.length === 0 || !foundOpaqueBackground) {
    const canvasBackground = getCanvasBackground();
    backgroundLayers.unshift(canvasBackground);
    console.log('Added canvas background:', canvasBackground);
  }

  // Blend all background layers
  const blendedBackground = blendBackgroundLayers(backgroundLayers);
  
  console.log('Final blended background:', {
    layers: backgroundLayers.length,
    foundOpaqueBackground,
    result: blendedBackground
  });

  return blendedBackground;
}

function getTextNodeFillColor(node: TextNode): ColorWithOpacity | null {
  const fills = node.fills;
  if (fills && fills !== figma.mixed && fills.length > 0) {
    const fill = fills[0];
    if (fill.type === 'SOLID') {
      console.log('Text node properties:', {
        name: node.name,
        layerOpacity: node.opacity,
        fillOpacity: fill.opacity,
        color: fill.color
      });
      
      return {
        color: fill.color,
        fillOpacity: fill.opacity ?? 1,
        layerOpacity: node.opacity ?? 1
      };
    }
  }
  return null;
}

function analyzeFontWeights(node: TextNode): {
  segments: FontWeightSegment[];
  lowestWeight: number;
  highestWeight: number;
  hasMixedWeights: boolean;
} {
  const segments: FontWeightSegment[] = [];
  const characters = node.getStyledTextSegments(['fontWeight', 'fontSize']);
  
  if (characters.length === 0) {
    return {
      segments: [],
      lowestWeight: 400,
      highestWeight: 400,
      hasMixedWeights: false
    };
  }

  const weights = new Set<number>();
  
  characters.forEach(char => {
    const weight = typeof char.fontWeight === 'number' ? char.fontWeight : 400;
    const size = typeof char.fontSize === 'number' ? char.fontSize : 14;
    weights.add(weight);
    
    segments.push({
      text: char.characters,
      weight,
      fontSize: size,
      position: {
        start: char.start,
        end: char.end
      }
    });
  });

  const weightArray = Array.from(weights);
  
  return {
    segments,
    lowestWeight: Math.min(...weightArray),
    highestWeight: Math.max(...weightArray),
    hasMixedWeights: weightArray.length > 1
  };
}

function generateRecommendations(
  contrastRatio: number,
  requiredRatio: number,
  textColor: string,
  backgroundColor: string,
  blendedTextColor: string | undefined,
  effectiveOpacity: number,
  hasMixedWeights?: boolean,
  fontWeightSegments?: FontWeightSegment[],
  lowestWeight?: number,
  highestWeight?: number
): string[] {
  const recommendations: string[] = [];
  
  if (contrastRatio < requiredRatio) {
    recommendations.push(`Increase contrast ratio from ${contrastRatio.toFixed(2)}:1 to at least ${requiredRatio}:1`);
    
    if (effectiveOpacity < 1) {
      const opacityPercent = Math.round(effectiveOpacity * 100);
      recommendations.push(
        `Text opacity is ${opacityPercent}%, which blends with the background and reduces contrast. ` +
        `Original color: ${textColor}, Blended appearance: ${blendedTextColor}`
      );
    }
    
    if (hasMixedWeights && fontWeightSegments && lowestWeight && highestWeight) {
      recommendations.push(
        `This text uses mixed font weights (${lowestWeight} to ${highestWeight}). ` +
        `Some parts of the text may be harder to read:`
      );
      
      fontWeightSegments.forEach(segment => {
        if (segment.weight < 700) {  // If this segment is not bold
          recommendations.push(
            `- "${segment.text}" uses weight ${segment.weight}, ` +
            `which may need higher contrast at ${segment.fontSize}px`
          );
        }
      });
      
      recommendations.push(
        'Consider either increasing contrast for all text or using a consistent bold weight ' +
        'for better readability'
      );
    }
    
    const textColorObj = Color(blendedTextColor || textColor);
    const bgColorObj = Color(backgroundColor);
    
    if (textColorObj.luminosity() > bgColorObj.luminosity()) {
      recommendations.push('Try making the text darker');
    } else {
      recommendations.push('Try making the text lighter');
    }
  }
  
  return recommendations;
}

export function evaluateTextContrast(node: SceneNode): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  function traverse(node: SceneNode) {
    // Skip hidden nodes and their children
    if ('visible' in node && !node.visible) {
      return;
    }

    // Check if any parent is hidden
    let current: BaseNode | null = node.parent;
    while (current) {
      if ('visible' in current && !current.visible) {
        return;
      }
      current = current.parent;
    }

    if (node.type === 'TEXT') {
      const textFill = getTextNodeFillColor(node);
      const backgroundFill = findOpaqueBackground(node);

      if (textFill && backgroundFill) {
        const ownOpacity = 'opacity' in node ? (node.opacity ?? 1) : 1;
        const parentOpacity = getCumulativeOpacity(node.parent as SceneNode | null);
        const effectiveOpacity = ownOpacity * textFill.layerOpacity * textFill.fillOpacity * (textFill.color.a ?? 1) * parentOpacity;
        
        const blendedTextColor = blendWithBackground(textFill.color, backgroundFill.color, effectiveOpacity);
        
        const originalTextHex = convertFigmaColorToHex({ color: blendedTextColor, fillOpacity: 1, layerOpacity: 1 });
        const backgroundHex = convertFigmaColorToHex(backgroundFill);
        const contrastRatio = calculateContrastRatio({ color: blendedTextColor, fillOpacity: 1, layerOpacity: 1 }, backgroundFill);
        
        const fontWeights = analyzeFontWeights(node);
        const fontSize = node.fontSize as number || 14;
        // Use lowest weight for most conservative calculation
        const isBold = fontWeights.lowestWeight >= 700;
        
        const requiredRatio = getRequiredContrast(fontSize, isBold);
        const isCompliant = contrastRatio >= requiredRatio;

        if (!isCompliant) {
          const level = contrastRatio >= 7 ? 'AAA' : contrastRatio >= requiredRatio ? 'AA' : 'Fail';

          const issue: ContrastIssue = {
            nodeId: node.id,
            nodeName: node.name,
            textColor: originalTextHex,
            backgroundColor: backgroundHex,
            blendedTextColor: originalTextHex,
            fontSize,
            isBold,
            contrastRatio,
            requiredRatio,
            isCompliant,
            level,
            effectiveOpacity,
            hasMixedWeights: fontWeights.hasMixedWeights,
            fontWeightSegments: fontWeights.segments,
            lowestWeight: fontWeights.lowestWeight,
            highestWeight: fontWeights.highestWeight,
            weightAnalysisNote: fontWeights.hasMixedWeights 
              ? `Using most conservative font weight (${fontWeights.lowestWeight}) for contrast calculation`
              : undefined
          };

          issue.recommendations = generateRecommendations(
            contrastRatio,
            requiredRatio,
            originalTextHex,
            backgroundHex,
            originalTextHex,
            effectiveOpacity,
            fontWeights.hasMixedWeights,
            fontWeights.segments,
            fontWeights.lowestWeight,
            fontWeights.highestWeight
          );

          issues.push(issue);
        }
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return issues;
}

function getRequiredContrast(fontSize: number, isBold: boolean): number {
  const largeText = fontSize >= 18 || (fontSize >= 14 && isBold);
  return largeText ? 3 : 4.5;
}

function blendWithBackground(foreground: FigmaColor, background: FigmaColor, alpha: number): FigmaColor {
  return {
    r: alpha * foreground.r + (1 - alpha) * background.r,
    g: alpha * foreground.g + (1 - alpha) * background.g,
    b: alpha * foreground.b + (1 - alpha) * background.b
  };
}
