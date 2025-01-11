import Color from 'color';

interface ContrastIssue {
  nodeId: string;
  nodeName: string;
  textColor: string;
  backgroundColor: string;
  fontSize: number;
  isBold: boolean;
  contrastRatio?: number;
  requiredRatio?: number;
  isCompliant?: boolean;
  level?: 'AAA' | 'AA' | 'Fail';
  recommendations?: string[];
}

export function convertFigmaColorToHex(color: { r: number; g: number; b: number }): string {
  // Figma colors are in 0-1 range, convert to 0-255
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return Color.rgb(r, g, b).hex();
}

export function calculateContrastRatio(textHex: string, backgroundHex: string): number {
  return Color(textHex).contrast(Color(backgroundHex));
}

export function getRequiredContrast(fontSize: number, isBold: boolean): number {
  const largeText = fontSize >= 18 || (fontSize >= 14 && isBold);
  return largeText ? 3 : 4.5; // Level AA requirements
}

function getTextNodeFillColor(node: TextNode): { r: number; g: number; b: number } | null {
  const fills = node.fills;
  if (fills && fills !== figma.mixed && fills.length > 0 && fills[0].type === 'SOLID') {
    return fills[0].color;
  }
  return null;
}

function getBackgroundNodeFillColor(node: BaseNode & { fills?: Paint[] | PluginAPI['mixed'] }): { r: number; g: number; b: number } | null {
  if ('fills' in node && node.fills && node.fills !== figma.mixed) {
    const fills = node.fills;
    if (fills.length > 0 && fills[0].type === 'SOLID') {
      return fills[0].color;
    }
  }
  return null;
}

function findParentBackground(node: BaseNode): { r: number; g: number; b: number } {
  let parent = node.parent;
  while (parent) {
    const color = getBackgroundNodeFillColor(parent as BaseNode & { fills?: Paint[] });
    if (color) {
      return color;
    }
    parent = parent.parent;
  }
  // Default to white if no background is found
  return { r: 1, g: 1, b: 1 };
}

function generateRecommendations(contrastRatio: number, requiredRatio: number, textColor: string, backgroundColor: string): string[] {
  const recommendations: string[] = [];
  
  if (contrastRatio < requiredRatio) {
    const textColorObj = Color(textColor);
    const bgColorObj = Color(backgroundColor);
    
    recommendations.push(`Increase contrast ratio from ${contrastRatio.toFixed(2)} to at least ${requiredRatio}`);
    
    // If text is lighter than background
    if (textColorObj.luminosity() > bgColorObj.luminosity()) {
      recommendations.push('Consider using a lighter background color or darker text color');
      recommendations.push('Try making the text color more saturated');
    } else {
      recommendations.push('Consider using a darker background color or lighter text color');
      recommendations.push('Try reducing the text color saturation');
    }
  }
  
  return recommendations;
}

export function evaluateTextContrast(node: SceneNode): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  function traverse(node: SceneNode) {
    // Check if node is a text node
    if (node.type === 'TEXT') {
      const textColor = getTextNodeFillColor(node);
      const backgroundColor = findParentBackground(node);

      if (textColor && backgroundColor) {
        const textHex = convertFigmaColorToHex(textColor);
        const bgHex = convertFigmaColorToHex(backgroundColor);
        
        const fontSize = node.fontSize as number || 14;
        const isBold = (node.fontWeight as number) >= 700;
        
        const contrastRatio = calculateContrastRatio(textHex, bgHex);
        const requiredRatio = getRequiredContrast(fontSize, isBold);
        const isCompliant = contrastRatio >= requiredRatio;

        // Only add non-compliant items to issues
        if (!isCompliant) {
          const level = contrastRatio >= 7 ? 'AAA' : contrastRatio >= requiredRatio ? 'AA' : 'Fail';

          const issue: ContrastIssue = {
            nodeId: node.id,
            nodeName: node.name,
            textColor: textHex,
            backgroundColor: bgHex,
            fontSize,
            isBold,
            contrastRatio,
            requiredRatio,
            isCompliant,
            level,
            recommendations: generateRecommendations(contrastRatio, requiredRatio, textHex, bgHex)
          };

          issues.push(issue);
        }
      }
    }

    // Recursively traverse children
    if ('children' in node) {
      (node.children as SceneNode[]).forEach(child => traverse(child));
    }
  }

  traverse(node);
  return issues;
}
