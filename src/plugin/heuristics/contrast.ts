import Color from 'color';

interface ContrastIssue {
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

export function convertFigmaColorToHex(colorInfo: ColorWithOpacity, backgroundColor?: ColorWithOpacity): string {
  const { color, fillOpacity, layerOpacity } = colorInfo;
  
  const effectiveOpacity = fillOpacity * layerOpacity * (color.a ?? 1);
  
  const foregroundRGB = figmaColorToRGB(color);
  
  if (effectiveOpacity < 1 && backgroundColor) {
    const backgroundRGB = figmaColorToRGB(backgroundColor.color);
    
    const blendedColor = alphaBlend(foregroundRGB, backgroundRGB, effectiveOpacity);
    
    console.log('Color blending:', {
      foreground: foregroundRGB,
      background: backgroundRGB,
      opacity: effectiveOpacity,
      blended: blendedColor
    });
    
    return rgbToHex(blendedColor);
  }
  
  return rgbToHex(foregroundRGB);
}

export function calculateContrastRatio(textColor: string, backgroundColor: string): number {
  const text = Color(textColor);
  const background = Color(backgroundColor);
  
  const ratio = text.contrast(background);
  
  console.log('Contrast calculation:', {
    text: text.toString(),
    background: background.toString(),
    ratio
  });
  
  return ratio;
}

export function getRequiredContrast(fontSize: number, isBold: boolean): number {
  const largeText = fontSize >= 18 || (fontSize >= 14 && isBold);
  return largeText ? 3 : 4.5;
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

function findOpaqueBackground(node: BaseNode): ColorWithOpacity | null {
  let parent = node.parent;
  let accumulatedOpacity = 1;
  
  while (parent) {
    if ('fills' in parent && parent.fills && parent.fills !== figma.mixed) {
      const fills = (parent.fills as Paint[]).filter(fill => fill.visible !== false);
      if (fills.length > 0) {
        const fill = fills[0];
        if (fill.type === 'SOLID') {
          const parentOpacity = 'opacity' in parent ? parent.opacity ?? 1 : 1;
          const fillOpacity = fill.opacity ?? 1;
          
          accumulatedOpacity *= parentOpacity * fillOpacity;
          
          if (accumulatedOpacity === 1 || !parent.parent) {
            console.log('Found background:', {
              name: parent.name,
              color: fill.color,
              opacity: accumulatedOpacity
            });
            
            return {
              color: fill.color,
              fillOpacity: fillOpacity,
              layerOpacity: parentOpacity
            };
          }
        }
      }
    }
    parent = parent.parent;
  }
  
  return {
    color: { r: 1, g: 1, b: 1 },
    fillOpacity: 1,
    layerOpacity: 1
  };
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
