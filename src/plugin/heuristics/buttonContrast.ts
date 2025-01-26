import { ContrastIssue, ColorWithOpacity, findOpaqueBackground, calculateContrastRatio, convertFigmaColorToHex } from './contrast';
import { getNodeFillOpacity, getNodeLayerOpacity } from './utils';
import Color from 'color';
import { defaultButtonConfig } from './config/buttonDetection';
import { detectButton } from './utils/buttonDetection';
import { ButtonDetectionDebugLevel } from './config/buttonDetection';

interface ButtonContrastIssue {
  nodeId: string;
  nodeName: string;
  textColor: string;
  backgroundColor: string;
  fontSize: number | undefined;
  isBold: boolean;
  severity: string;
  outlineContrast?: {
    strokeColor: string;
    containerColor: string;
    strokeContrastRatio: number;
    strokeWeight: number;
    isCompliant: boolean;
    minimum: number;
  };
  containerContrast?: {
    containerColor: string;
    buttonBackgroundColor: string;
    boundaryContrastRatio: number;
    isCompliant: boolean;
    minimum: number;
  };
}

interface GradientStop {
  position: number;
  color: RGB;
}

interface BasePaint {
  type: string;
  opacity?: number;
  visible?: boolean;
}

interface SolidPaint extends BasePaint {
  type: 'SOLID';
  color: RGB;
}

interface GradientPaint extends BasePaint {
  type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL';
  gradientStops: GradientStop[];
}

type Paint = SolidPaint | GradientPaint;

interface ExtendedSolidPaint extends SolidPaint {
  strokeWeight?: number;
  strokeAlign?: 'CENTER' | 'INSIDE' | 'OUTSIDE';
  dashPattern?: number[];
}

interface ExtendedGradientPaint extends GradientPaint {
  strokeWeight?: number;
  strokeAlign?: 'CENTER' | 'INSIDE' | 'OUTSIDE';
  dashPattern?: number[];
}

type ExtendedPaint = ExtendedSolidPaint | ExtendedGradientPaint;

interface ComplexFill {
  effectiveOpacity: number;
  effectiveColor: ColorWithOpacity;
}

interface StrokeAnalysis {
  effectiveColor: ColorWithOpacity;
  strokeWeight: number;
  isDashed: boolean;
  isGradient: boolean;
  position: 'CENTER' | 'INSIDE' | 'OUTSIDE';
}

interface ButtonStyle {
  type: 'solid' | 'outline' | 'ghost' | 'mixed';
  backgroundColor?: ColorWithOpacity;
  strokeColor?: ColorWithOpacity;
  strokeWeight?: number;
  fillOpacity?: number;
  complexProperties?: {
    isDashed: boolean;
    isGradient: boolean;
    strokePosition: string;
    hasMultipleFills: boolean;
  };
}

export const BUTTON_CONTRAST_REQUIREMENTS = {
  // Standard WCAG requirements for text
  text: {
    normal: 4.5,
    large: 3.0
  },
  // Requirements for button boundaries
  boundary: {
    minimum: 3.0,      // Minimum required for WCAG 2.1 compliance
    recommended: 4.5   // Recommended for better visibility
  },
  // Requirements for outline buttons
  outline: {
    stroke: {
      minimum: 3.0,    // Minimum stroke contrast for WCAG 2.1
      recommended: 4.5 // Recommended stroke contrast
    },
    weight: {
      minimum: 1,      // Minimum stroke weight in pixels
      recommended: 1.5 // Recommended stroke weight
    }
  },
  // State contrast requirements
  states: {
    hover: 1.5,       // Minimum contrast between default and hover states
    active: 2.0,      // Minimum contrast between default and active states
    disabled: 2.0     // Minimum contrast between default and disabled states
  }
};

function analyzeComplexStroke(strokes: Paint[]): StrokeAnalysis {
  if (!strokes.length) {
    return {
      effectiveColor: {
        color: { r: 0, g: 0, b: 0 },
        fillOpacity: 0,
        layerOpacity: 1
      },
      strokeWeight: 1,
      isDashed: false,
      isGradient: false,
      position: 'CENTER'
    };
  }

  const primaryStroke = strokes[0] as ExtendedPaint;
  let effectiveColor: RGB = { r: 0, g: 0, b: 0 };
  let effectiveOpacity = 0;
  
  if (primaryStroke.type === 'SOLID') {
    effectiveColor = primaryStroke.color;
    effectiveOpacity = primaryStroke.opacity ?? 1;
  } else {
    // For gradients, use the darkest stop color for contrast
    const darkestStop = primaryStroke.gradientStops.reduce((darkest: GradientStop, stop: GradientStop) => {
      const luminance = 0.299 * stop.color.r + 0.587 * stop.color.g + 0.114 * stop.color.b;
      const darkestLuminance = 0.299 * darkest.color.r + 0.587 * darkest.color.g + 0.114 * darkest.color.b;
      return luminance < darkestLuminance ? stop : darkest;
    }, primaryStroke.gradientStops[0]);
    effectiveColor = darkestStop.color;
    effectiveOpacity = primaryStroke.opacity ?? 1;
  }

  return {
    effectiveColor: {
      color: effectiveColor,
      fillOpacity: effectiveOpacity,
      layerOpacity: 1
    },
    strokeWeight: primaryStroke.strokeWeight ?? 1,
    isDashed: Array.isArray(primaryStroke.dashPattern) && primaryStroke.dashPattern.length > 0,
    isGradient: primaryStroke.type !== 'SOLID',
    position: primaryStroke.strokeAlign ?? 'CENTER'
  };
}

function determineEffectiveColor(fills: Paint[]): ColorWithOpacity {
  if (!fills.length) {
    return {
      color: { r: 0, g: 0, b: 0 },
      fillOpacity: 0,
      layerOpacity: 1
    };
  }

  let effectiveColor: RGB = { r: 0, g: 0, b: 0 };
  let effectiveOpacity = 0;
  
  fills.forEach((fill, index) => {
    if (fill.type === 'SOLID' && fill.visible !== false) {
      const fillOpacity = fill.opacity ?? 1;
      
      if (index === 0) {
        effectiveOpacity = fillOpacity;
        effectiveColor = fill.color;
      } else {
        // Simple alpha blending for multiple fills
        const remainingOpacity = (1 - effectiveOpacity) * fillOpacity;
        effectiveOpacity += remainingOpacity;
        
        effectiveColor = {
          r: (effectiveColor.r * effectiveOpacity + fill.color.r * remainingOpacity) / (effectiveOpacity + remainingOpacity),
          g: (effectiveColor.g * effectiveOpacity + fill.color.g * remainingOpacity) / (effectiveOpacity + remainingOpacity),
          b: (effectiveColor.b * effectiveOpacity + fill.color.b * remainingOpacity) / (effectiveOpacity + remainingOpacity)
        };
      }
    } else if ((fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL') && fill.visible !== false) {
      // For gradients, use the darkest stop color for contrast
      const darkestStop = fill.gradientStops.reduce((darkest: GradientStop, stop: GradientStop) => {
        const luminance = 0.299 * stop.color.r + 0.587 * stop.color.g + 0.114 * stop.color.b;
        const darkestLuminance = 0.299 * darkest.color.r + 0.587 * darkest.color.g + 0.114 * darkest.color.b;
        return luminance < darkestLuminance ? stop : darkest;
      }, fill.gradientStops[0]);
      
      if (index === 0) {
        effectiveOpacity = fill.opacity ?? 1;
        effectiveColor = darkestStop.color;
      }
    }
  });

  return {
    color: effectiveColor,
    fillOpacity: effectiveOpacity,
    layerOpacity: 1
  };
}

function determineButtonStyle(node: SceneNode): ButtonStyle {
  if (!('strokes' in node) || !('fills' in node)) {
    return { type: 'solid' };
  }
  
  const strokes = (node.strokes as Paint[]).filter(stroke => stroke.visible !== false);
  const fills = (node.fills as Paint[]).filter(fill => fill.visible !== false);
  
  // Handle complex fills
  const effectiveFill = determineEffectiveColor(fills);
  
  // Handle complex strokes
  const strokeAnalysis = strokes.length > 0 ? analyzeComplexStroke(strokes) : null;
  
  // Determine if it's a mixed-style button with complex properties
  if (effectiveFill && strokeAnalysis) {
    const fillOpacity = effectiveFill.fillOpacity;
    
    if (fillOpacity > 0 && fillOpacity < 0.5) {
      return {
        type: 'mixed',
        strokeColor: strokeAnalysis.effectiveColor,
        backgroundColor: effectiveFill,
        strokeWeight: strokeAnalysis.strokeWeight,
        fillOpacity: fillOpacity,
        complexProperties: {
          isDashed: strokeAnalysis.isDashed,
          isGradient: strokeAnalysis.isGradient,
          strokePosition: strokeAnalysis.position,
          hasMultipleFills: fills.length > 1
        }
      };
    }
  }
  
  // Check if it's a mixed style button
  if (strokes.length > 0 && fills.length > 0) {
    const stroke = strokes[0] as ExtendedPaint;
    const fill = fills[0];
    
    if (stroke.type === 'SOLID' && fill.type === 'SOLID') {
      const fillOpacity = fill.opacity ?? 1;
      
      // If fill opacity is low but not zero, and there's a stroke, it's a mixed style
      if (fillOpacity > 0 && fillOpacity < 0.5) {
        return {
          type: 'mixed',
          strokeColor: {
            color: stroke.color,
            fillOpacity: stroke.opacity ?? 1,
            layerOpacity: 1
          },
          backgroundColor: {
            color: fill.color,
            fillOpacity: fillOpacity,
            layerOpacity: 1
          },
          strokeWeight: typeof node.strokeWeight === 'number' ? node.strokeWeight : 1,
          fillOpacity: fillOpacity
        };
      }
    }
  }
  
  // Check if it's an outline button
  if (strokes.length > 0 && 
      (fills.length === 0 || fills.every(fill => (fill.opacity ?? 0) < 0.1))) {
    const stroke = strokes[0] as ExtendedPaint;
    if (stroke.type === 'SOLID') {
      return {
        type: 'outline',
        strokeColor: {
          color: stroke.color,
          fillOpacity: stroke.opacity ?? 1,
          layerOpacity: 1
        },
        strokeWeight: typeof node.strokeWeight === 'number' ? node.strokeWeight : 1
      };
    }
  }
  
  // Check if it's a ghost button
  if (fills.length === 0 || fills.every(fill => (fill.opacity ?? 0) < 0.1)) {
    return { type: 'ghost' };
  }
  
  // Default to solid button
  return {
    type: 'solid',
    backgroundColor: effectiveFill
  };
}

function findImmediateContainerBackground(node: SceneNode): ColorWithOpacity {
  const parent = node.parent;
  
  if (!parent) {
    return findOpaqueBackground(node);
  }

  if ('fills' in parent && parent.fills && parent.fills !== figma.mixed) {
    const fills = (parent.fills as Paint[]).filter(fill => fill.visible !== false);
    
    for (const fill of fills) {
      if (fill.type === 'SOLID' && fill.color) {
        return {
          color: fill.color,
          fillOpacity: fill.opacity ?? 1,
          layerOpacity: 1
        };
      }
    }
  }
  
  // If no immediate background found, traverse up the tree
  return findOpaqueBackground(parent);
}

function generateBoundaryRecommendations(
  boundaryContrastRatio: number,
  buttonColor: string,
  containerColor: string
): string[] {
  const recommendations: string[] = [];
  const { minimum, recommended } = BUTTON_CONTRAST_REQUIREMENTS.boundary;
  
  if (boundaryContrastRatio < minimum) {
    recommendations.push(
      `Increase the contrast between the button and its container. Current ratio: ${boundaryContrastRatio.toFixed(2)}, Required: ${minimum}`
    );
    
    // Suggest color adjustments
    const buttonColorObj = Color(buttonColor);
    const containerColorObj = Color(containerColor);
    
    // If button is lighter than container
    if (buttonColorObj.isLight()) {
      recommendations.push(
        'Consider making the button lighter or the container darker to achieve better contrast'
      );
    } else {
      recommendations.push(
        'Consider making the button darker or the container lighter to achieve better contrast'
      );
    }
    
    // Suggest alternative approaches
    recommendations.push(
      'Add a border or shadow to the button to increase visibility against the background'
    );
  } else if (boundaryContrastRatio < recommended) {
    recommendations.push(
      `Consider increasing the contrast for better visibility. Current ratio: ${boundaryContrastRatio.toFixed(2)}, Recommended: ${recommended}`
    );
  }
  
  return recommendations;
}

function generateOutlineRecommendations(
  strokeContrastRatio: number,
  strokeWeight: number,
  strokeColor: string,
  containerColor: string
): string[] {
  const recommendations: string[] = [];
  const { minimum: minStrokeContrast } = BUTTON_CONTRAST_REQUIREMENTS.outline.stroke;
  const { minimum: minWeight } = BUTTON_CONTRAST_REQUIREMENTS.outline.weight;
  
  if (strokeContrastRatio < minStrokeContrast) {
    recommendations.push(
      `Increase the contrast between the button outline (${strokeColor}) and its container (${containerColor}). Current ratio: ${strokeContrastRatio.toFixed(2)}, Required: ${minStrokeContrast}`
    );
  }
  
  if (strokeWeight < minWeight) {
    recommendations.push(
      `Increase the outline weight. Current: ${strokeWeight}px, Minimum: ${minWeight}px`
    );
  }
  
  return recommendations;
}

function generateMixedStyleRecommendations(
  strokeContrastRatio: number,
  fillContrastRatio: number,
  strokeWeight: number,
  fillOpacity: number,
  strokeColorHex: string,
  fillColorHex: string,
  containerBackgroundHex: string,
  complexProperties: {
    isDashed: boolean;
    isGradient: boolean;
    strokePosition: string;
    hasMultipleFills: boolean;
  }
): string[] {
  const recommendations: string[] = [];

  // Check stroke contrast
  if (strokeContrastRatio < BUTTON_CONTRAST_REQUIREMENTS.outline.stroke.minimum) {
    recommendations.push(
      `Increase the contrast between the button stroke and its container. Current ratio: ${strokeContrastRatio.toFixed(2)}, Required: ${BUTTON_CONTRAST_REQUIREMENTS.outline.stroke.minimum}`
    );
  }

  // Check fill contrast
  if (fillContrastRatio < BUTTON_CONTRAST_REQUIREMENTS.boundary.minimum) {
    recommendations.push(
      `Increase the contrast between the button fill and its container. Current ratio: ${fillContrastRatio.toFixed(2)}, Required: ${BUTTON_CONTRAST_REQUIREMENTS.boundary.minimum}`
    );
  }

  // Check stroke weight
  if (strokeWeight < BUTTON_CONTRAST_REQUIREMENTS.outline.weight.minimum) {
    recommendations.push(
      `Increase the stroke weight. Current weight: ${strokeWeight}px, Minimum required: ${BUTTON_CONTRAST_REQUIREMENTS.outline.weight.minimum}px`
    );
  }

  // Check fill opacity
  if (fillOpacity < 0.5) {
    recommendations.push(
      `Consider increasing the fill opacity for better visibility. Current opacity: ${(fillOpacity * 100).toFixed(1)}%`
    );
  }

  // Handle complex properties
  if (complexProperties.isDashed) {
    recommendations.push(
      'Consider using a solid stroke instead of a dashed stroke for better visibility'
    );
  }

  if (complexProperties.isGradient) {
    recommendations.push(
      'Consider using solid colors instead of gradients for better contrast consistency'
    );
  }

  if (complexProperties.strokePosition !== 'CENTER') {
    recommendations.push(
      'Consider using center-aligned strokes for consistent button boundaries'
    );
  }

  if (complexProperties.hasMultipleFills) {
    recommendations.push(
      'Consider simplifying the button design by using a single fill layer'
    );
  }

  return recommendations;
}

function generateSolidRecommendations(boundaryContrastRatio: number): string[] {
  const recommendations: string[] = [];
  const { minimum } = BUTTON_CONTRAST_REQUIREMENTS.boundary;
  
  if (boundaryContrastRatio < minimum) {
    recommendations.push(
      `Increase the contrast between the button and its container. Current ratio: ${boundaryContrastRatio.toFixed(2)}, Required: ${minimum}`
    );
  }
  
  return recommendations;
}

function isButtonComponent(node: SceneNode): boolean {
  // Check if it's a component or instance with "button" in the name
  if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    const nodeName = node.name.toLowerCase();
    const isButton = nodeName.includes('button') || nodeName.includes('btn');
    if (isButton) return true;
  }

  // Check if it has button-like properties
  if ('fills' in node && 'strokes' in node) {
    // Check if the node has text content
    const hasText = 'characters' in node && node.characters.length > 0;
    
    // Check if it has fills or strokes
    const hasFills = (node.fills as Paint[]).some(fill => fill.visible !== false);
    const hasStrokes = (node.strokes as Paint[]).some(stroke => stroke.visible !== false);
    
    return hasText && (hasFills || hasStrokes);
  }

  // If it's a frame or group, check its children
  if ('children' in node) {
    // Look for text nodes and button-like properties in children
    const hasButtonChild = node.children.some(child => 
      child.type === 'TEXT' || 
      (child.name.toLowerCase().includes('button') || child.name.toLowerCase().includes('btn'))
    );
    
    const hasVisibleFills = node.children.some(child => 
      'fills' in child && 
      (child.fills as Paint[]).some(fill => fill.visible !== false)
    );
    
    const hasVisibleStrokes = node.children.some(child => 
      'strokes' in child && 
      (child.strokes as Paint[]).some(stroke => stroke.visible !== false)
    );

    return hasButtonChild && (hasVisibleFills || hasVisibleStrokes);
  }

  return false;
}

export function evaluateButtonContrast(node: SceneNode): ButtonContrastIssue[] {
  const issues: ButtonContrastIssue[] = [];
  console.log('Starting button contrast evaluation for node:', node.name);
  traverseNodesForButtons(node, issues);
  console.log('Found button issues:', issues.length);
  return issues;
}

function traverseNodesForButtons(node: SceneNode, issues: ButtonContrastIssue[]) {
  try {
    // Check if current node is a button
    const buttonDetection = detectButton(node, defaultButtonConfig, ButtonDetectionDebugLevel.DETAILED);
    
    if (buttonDetection.isButton) {
      console.log('Found button:', node.name, 'Score:', buttonDetection.score, 'Reasons:', buttonDetection.reasons);
      // Evaluate the current node
      const buttonStyle = determineButtonStyle(node);
      console.log('Button style:', buttonStyle);
      const styleIssues = evaluateButtonStyle(node, buttonStyle);
      issues.push(...styleIssues);
    } else if (buttonDetection.score > 0) {
      console.log('Node almost qualified as button:', node.name, 'Score:', buttonDetection.score, 'Reasons:', buttonDetection.reasons);
    }

    // Recursively check children
    if ('children' in node) {
      for (const child of node.children) {
        traverseNodesForButtons(child, issues);
      }
    }
  } catch (error) {
    console.error('Error evaluating node:', node.name, error);
  }
}

function evaluateButtonStyle(node: SceneNode, buttonStyle: ButtonStyle): ButtonContrastIssue[] {
  try {
    const issues: ButtonContrastIssue[] = [];
    const containerBackground = findImmediateContainerBackground(node);
    const containerBackgroundHex = convertFigmaColorToHex(containerBackground);
    
    console.log('Evaluating button style for:', node.name);
    console.log('Container background:', containerBackgroundHex);
    
    const textNode = node as TextNode;
    const fontSize = typeof textNode.fontSize === 'number' ? textNode.fontSize : undefined;
    const fontWeight = typeof textNode.fontWeight === 'number' ? textNode.fontWeight : undefined;
    
    let issue: ButtonContrastIssue | null = null;

    if (buttonStyle.type === 'mixed' && buttonStyle.strokeColor && buttonStyle.backgroundColor) {
      const strokeColorHex = convertFigmaColorToHex(buttonStyle.strokeColor);
      const fillColorHex = convertFigmaColorToHex(buttonStyle.backgroundColor);
      
      console.log('Mixed style button:', {
        stroke: strokeColorHex,
        fill: fillColorHex,
        container: containerBackgroundHex
      });
      
      const strokeContrastRatio = calculateContrastRatio(
        strokeColorHex,
        containerBackgroundHex
      );
      
      const fillContrastRatio = calculateContrastRatio(
        fillColorHex,
        containerBackgroundHex
      );

      if (strokeContrastRatio < BUTTON_CONTRAST_REQUIREMENTS.outline.stroke.minimum ||
          fillContrastRatio < BUTTON_CONTRAST_REQUIREMENTS.boundary.minimum) {
        issue = {
          nodeId: node.id,
          nodeName: node.name,
          textColor: '', 
          backgroundColor: containerBackgroundHex,
          fontSize,
          isBold: fontWeight !== undefined ? fontWeight >= 600 : false,
          severity: 'medium',
          outlineContrast: {
            strokeColor: strokeColorHex,
            containerColor: containerBackgroundHex,
            strokeContrastRatio,
            strokeWeight: buttonStyle.strokeWeight || 1,
            isCompliant: strokeContrastRatio >= BUTTON_CONTRAST_REQUIREMENTS.outline.stroke.minimum,
            minimum: BUTTON_CONTRAST_REQUIREMENTS.outline.stroke.minimum
          }
        };
      }
    } else if (buttonStyle.type === 'outline' && buttonStyle.strokeColor) {
      const strokeColorHex = convertFigmaColorToHex(buttonStyle.strokeColor);
      console.log('Outline button:', {
        stroke: strokeColorHex,
        container: containerBackgroundHex
      });
      
      const strokeContrastRatio = calculateContrastRatio(
        strokeColorHex,
        containerBackgroundHex
      );
      
      if (strokeContrastRatio < BUTTON_CONTRAST_REQUIREMENTS.outline.stroke.minimum) {
        issue = {
          nodeId: node.id,
          nodeName: node.name,
          textColor: '',
          backgroundColor: containerBackgroundHex,
          fontSize,
          isBold: fontWeight !== undefined ? fontWeight >= 600 : false,
          severity: 'medium',
          outlineContrast: {
            strokeColor: strokeColorHex,
            containerColor: containerBackgroundHex,
            strokeContrastRatio,
            strokeWeight: buttonStyle.strokeWeight || 1,
            isCompliant: false,
            minimum: BUTTON_CONTRAST_REQUIREMENTS.outline.stroke.minimum
          }
        };
      }
    } else if (buttonStyle.type === 'solid' && buttonStyle.backgroundColor) {
      const fillColorHex = convertFigmaColorToHex(buttonStyle.backgroundColor);
      console.log('Solid button:', {
        fill: fillColorHex,
        container: containerBackgroundHex
      });
      
      const fillContrastRatio = calculateContrastRatio(
        fillColorHex,
        containerBackgroundHex
      );
      
      if (fillContrastRatio < BUTTON_CONTRAST_REQUIREMENTS.boundary.minimum) {
        issue = {
          nodeId: node.id,
          nodeName: node.name,
          textColor: '',
          backgroundColor: containerBackgroundHex,
          fontSize,
          isBold: fontWeight !== undefined ? fontWeight >= 600 : false,
          severity: 'medium',
          containerContrast: {
            containerColor: containerBackgroundHex,
            buttonBackgroundColor: fillColorHex,
            boundaryContrastRatio: fillContrastRatio,
            isCompliant: false,
            minimum: BUTTON_CONTRAST_REQUIREMENTS.boundary.minimum
          }
        };
      }
    }

    if (issue) {
      console.log('Adding button contrast issue for:', node.name);
      issues.push(issue);
    } else {
      console.log('Button passes contrast check:', node.name);
    }

    return issues;
  } catch (error) {
    console.error('Error evaluating button style:', node.name, error);
    return [];
  }
}
