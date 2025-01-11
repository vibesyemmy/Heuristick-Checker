import Color from 'color';

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

export function calculateContrastRatio(color1: string, color2: string): number {
  const c1 = Color(color1);
  const c2 = Color(color2);
  
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

export function evaluateTextContrast(node: SceneNode): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  function traverse(node: SceneNode) {
    if (node.type === 'TEXT') {
      const textFill = getTextNodeFillColor(node);
      const backgroundFill = findOpaqueBackground(node);

      if (textFill && backgroundFill) {
        const effectiveOpacity = textFill.layerOpacity * textFill.fillOpacity * (textFill.color.a ?? 1);
        
        const originalTextHex = convertFigmaColorToHex(textFill);
        const backgroundHex = convertFigmaColorToHex(backgroundFill);
        
        const blendedTextHex = convertFigmaColorToHex(textFill, backgroundFill);
        
        const fontSize = node.fontSize as number || 14;
        const isBold = (node.fontWeight as number) >= 700;
        
        const contrastRatio = calculateContrastRatio(blendedTextHex, backgroundHex);
        const requiredRatio = getRequiredContrast(fontSize, isBold);
        const isCompliant = contrastRatio >= requiredRatio;

        console.log('Node evaluation:', {
          name: node.name,
          originalColor: originalTextHex,
          blendedColor: blendedTextHex,
          effectiveOpacity,
          contrastRatio,
          requiredRatio,
          isCompliant
        });

        if (!isCompliant) {
          const level = contrastRatio >= 7 ? 'AAA' : contrastRatio >= requiredRatio ? 'AA' : 'Fail';

          const issue: ContrastIssue = {
            nodeId: node.id,
            nodeName: node.name,
            textColor: originalTextHex,
            backgroundColor: backgroundHex,
            blendedTextColor: blendedTextHex,
            fontSize,
            isBold,
            contrastRatio,
            requiredRatio,
            isCompliant,
            level,
            effectiveOpacity,
            recommendations: generateRecommendations(
              contrastRatio,
              requiredRatio,
              originalTextHex,
              backgroundHex,
              blendedTextHex,
              effectiveOpacity
            )
          };

          issues.push(issue);
        }
      }
    }

    if ('children' in node) {
      (node.children as SceneNode[]).forEach(child => traverse(child));
    }
  }

  traverse(node);
  return issues;
}

function generateRecommendations(
  contrastRatio: number,
  requiredRatio: number,
  textColor: string,
  backgroundColor: string,
  blendedTextColor: string | undefined,
  effectiveOpacity: number
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
    
    const textColorObj = Color(blendedTextColor || textColor);
    const bgColorObj = Color(backgroundColor);
    
    if (textColorObj.luminosity() > bgColorObj.luminosity()) {
      recommendations.push('Try using a darker text color or lighter background');
    } else {
      recommendations.push('Try using a lighter text color or darker background');
    }
  }
  
  return recommendations;
}

function getRequiredContrast(fontSize: number, isBold: boolean): number {
  const largeText = fontSize >= 18 || (fontSize >= 14 && isBold);
  return largeText ? 3 : 4.5;
}
