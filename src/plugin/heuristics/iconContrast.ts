import { IconRole, IconContrastHeuristicResult, IconContrastResult, ColorAnalysisResult, FigmaColor } from './types';
import { defaultConfig } from './config';
import { isIconNode, isIconByName, isIconByType, isIconBySize, isIconByContext, determineIconRole, calculateIconScore } from './iconDetection';
import { blendWithBackground, calculateContrastRatio } from './colorUtils';

// Types

interface ColorWithOpacity {
  color: FigmaColor;
  fillOpacity: number;
  layerOpacity: number;
}

/**
 * Result of icon contrast heuristic analysis.
 * 
 * @property {string} id - Unique identifier for the result.
 * @property {string} nodeId - ID of the node being analyzed.
 * @property {string} nodeName - Name of the node being analyzed.
 * @property {'icon_contrast'} type - Type of heuristic result.
 * @property {'Accessibility'} category - Category of heuristic result.
 * @property {string} title - Title of the heuristic result.
 * @property {string} description - Description of the heuristic result.
 * @property {'high' | 'medium' | 'low'} severity - Severity of the contrast issue.
 * @property {IconRole} role - Role of the icon (interactive, informative, decorative).
 * @property {ColorAnalysisResult[]} colors - Array of colors used in the icon with their contrast ratios.
 * @property {FigmaColor} backgroundColor - Background color used for contrast calculation.
 * @property {number} contrastRatio - Calculated contrast ratio of the icon.
 * @property {number} requiredRatio - Required contrast ratio based on the icon's role.
 * @property {FigmaColor[]} failingColors - Array of colors that fail the contrast requirements.
 * @property {boolean} isCompliant - Whether the icon meets the contrast requirements.
 * @property {string[]} recommendations - Recommendations for improving icon contrast.
 */

// Calculate severity based on contrast ratio and required ratio
function calculateSeverity(contrastRatio: number, requiredRatio: number): 'high' | 'medium' | 'low' {
  // Calculate how far we are from the required ratio as a percentage
  const ratio = contrastRatio / requiredRatio;
  
  // Debug log the calculation
  console.log('Severity calculation:', {
    contrastRatio,
    requiredRatio,
    percentage: ratio * 100,
    thresholds: {
      high: '< 50%',
      medium: '< 75%',
      low: '< 100%'
    }
  });
  
  // High severity: less than 50% of required ratio
  if (ratio < 0.5) {
    return 'high';
  }
  
  // Medium severity: less than 75% of required ratio
  if (ratio < 0.75) {
    return 'medium';
  }
  
  // Low severity: less than 100% of required ratio
  return 'low';
}

// Find opaque background for a node
function findOpaqueBackground(node: SceneNode): ColorWithOpacity | null {
  // Start with the node's parent
  let current: BaseNode | null = node.parent;
  while (current) {
    // Check if the current node has fills
    if ('fills' in current) {
      const fills = Array.isArray(current.fills) ? current.fills : [];

      // Process all fills from bottom to top
      let result = { r: 0, g: 0, b: 0, a: 0 };
      let hasVisibleFill = false;

      for (let i = fills.length - 1; i >= 0; i--) {
        const fill = fills[i];
        if (fill.type === 'SOLID' && fill.visible) {
          const opacity = fill.opacity ?? 1;
          
          // Blend this fill with the accumulated result
          if (!hasVisibleFill) {
            // First visible fill
            result = {
              r: fill.color.r,
              g: fill.color.g,
              b: fill.color.b,
              a: opacity
            };
            hasVisibleFill = true;
          } else {
            // Blend with previous result using our color utilities
            const blended = blendWithBackground(
              { ...fill.color, a: opacity },
              result,
              opacity
            );
            result = { ...blended, a: blended.a ?? 1 };
          }
        }
      }

      if (hasVisibleFill) {
        return {
          color: result,
          fillOpacity: result.a,
          layerOpacity: 1,
        };
      }
    }

    current = current.parent;
  }

  // If no background found and we're in Figma, use canvas background color
  if (typeof figma !== 'undefined' && figma.currentPage?.backgrounds?.length > 0) {
    const background = figma.currentPage.backgrounds[0];
    if (background && background.type === 'SOLID') {
      const opacity = background.opacity ?? 1;
      return {
        color: { ...background.color, a: opacity },
        fillOpacity: opacity,
        layerOpacity: 1,
      };
    }
  }

  // Fallback to white only if canvas background is not available
  return {
    color: { r: 1, g: 1, b: 1, a: 1 },
    fillOpacity: 1,
    layerOpacity: 1,
  };
}

// Helper function to compute cumulative opacity from parent chain
export function getCumulativeOpacity(node: SceneNode | null): number {
  if (!node) return 1;
  // If node has an opacity property, use it; otherwise default to 1
  const currentOpacity = 'opacity' in node ? (node.opacity ?? 1) : 1;
  return currentOpacity * getCumulativeOpacity(node.parent as SceneNode | null);
}

// Extract colors from a node considering opacity
function isSceneNode(node: any): node is SceneNode {
  return node && typeof node === 'object' && 'opacity' in node;
}

function extractAllIconColors(node: SceneNode, parentOpacity: number = 1): ColorWithOpacity[] {
  if (!node || !isSceneNode(node)) {
    return [];
  }

  const colors: ColorWithOpacity[] = [];
  
  // Get the node's own opacity
  const nodeOpacity = 'opacity' in node ? (node.opacity ?? 1) : 1;
  const effectiveParentOpacity = parentOpacity * nodeOpacity;

  // Process fills if they exist
  if ('fills' in node && Array.isArray(node.fills)) {
    node.fills.forEach(fill => {
      if (fill?.type === 'SOLID' && fill.color && fill.visible !== false) {
        const fillOpacity = fill.opacity ?? 1;
        colors.push({
          color: fill.color,
          fillOpacity,
          layerOpacity: effectiveParentOpacity
        });
      }
    });
  }

  // Process children recursively
  if ('children' in node && Array.isArray(node.children)) {
    node.children.forEach(child => {
      if (isSceneNode(child)) {
        colors.push(...extractAllIconColors(child, effectiveParentOpacity));
      }
    });
  }

  return colors;
}

// Generate recommendations for improving icon contrast
function generateIconRecommendations(contrastRatio: number, threshold: number, role: IconRole): string[] {
  const recommendations: string[] = [];

  if (contrastRatio < threshold) {
    recommendations.push(`Increase the contrast ratio to at least ${threshold}:1 for ${role} icons`);
    
    if (contrastRatio < threshold / 2) {
      recommendations.push('Consider using a darker color for the icon on light backgrounds, or a lighter color on dark backgrounds');
    }
    
    if (role === 'interactive') {
      recommendations.push('Interactive icons need high contrast to ensure they are easily discoverable');
    }
  }

  return recommendations;
}

// Analyze a single node for icon contrast
export function analyzeIconContrast(
  node: SceneNode,
  result: IconContrastHeuristicResult
): IconContrastResult | null {
  try {
    // Find opaque background
    const background = findOpaqueBackground(node);
    const defaultBackground: FigmaColor = { r: 1, g: 1, b: 1 };

    // Return early if no background
    if (!background) {
      return {
        passed: false,
        description: 'No opaque background found.',
        severity: 'medium',
        role: result.role,
        colors: [],
        backgroundColor: defaultBackground,
        contrastRatio: 0,
        requiredRatio: 0,
        nodeId: node.id,
        nodeName: node.name
      };
    }

    // Compute cumulative opacity from parent chain
    const initialOpacity = getCumulativeOpacity(node.parent as SceneNode | null);

    // Extract all colors with their opacities, starting with the cumulative parent opacity
    const iconColors = extractAllIconColors(node, initialOpacity);
    const colorAnalysis: ColorAnalysisResult[] = [];
    let lowestContrastRatio = Infinity;

    // Analyze each color
    for (const { color, fillOpacity, layerOpacity } of iconColors) {
      // Calculate effective opacity
      const effectiveOpacity = fillOpacity * layerOpacity;
      
      // Blend the color with background considering effective opacity
      const blendedColor = blendWithBackground(color, background.color, effectiveOpacity);
      
      // Calculate contrast ratio with blended color
      const contrastRatio = calculateContrastRatio(blendedColor, background.color);
      
      colorAnalysis.push({
        original: color,
        blended: blendedColor,
        fillOpacity,
        layerOpacity,
        contrastRatio
      });

      // Track lowest contrast ratio
      if (contrastRatio < lowestContrastRatio) {
        lowestContrastRatio = contrastRatio;
      }
    }

    // Get required ratio based on icon role
    const requiredRatio = getRequiredContrastRatio(result.role);
    const passed = lowestContrastRatio >= requiredRatio;
    const severity = calculateSeverity(lowestContrastRatio, requiredRatio);
    const description = passed
      ? `Icon meets contrast requirements with ratio ${lowestContrastRatio.toFixed(2)}:1`
      : `Icon fails contrast requirements. Current: ${lowestContrastRatio.toFixed(2)}:1, Required: ${requiredRatio}:1`;

    return {
      passed,
      description,
      severity,
      role: result.role,
      colors: colorAnalysis,
      backgroundColor: background.color,
      contrastRatio: lowestContrastRatio,
      requiredRatio,
      nodeId: node.id,
      nodeName: node.name
    };
  } catch (error) {
    console.error('Error analyzing icon contrast:', error);
    return null;
  }
}

function getRequiredContrastRatio(role: 'interactive' | 'informative' | 'decorative'): number {
  switch (role) {
    case 'interactive':
      return 4.5;
    case 'informative':
      return 3;
    case 'decorative':
      return 2;
  }
}

// Main analysis function
export function evaluateIconContrast(node: SceneNode): IconContrastResult[] {
  const results: IconContrastResult[] = [];
  traverseNodesForIcons(node, results);
  
  // Only return results that failed the contrast check
  return results.filter(result => !result.passed);
}

// Recursive traversal function
function traverseNodesForIcons(node: SceneNode, results: IconContrastResult[]) {
  try {
    // Skip hidden nodes and invalid nodes
    if (!node || ('visible' in node && node.visible === false)) {
      return;
    }

    // Skip nodes that are not part of the current document
    if (!node.parent) {
      return;
    }

    // Calculate icon score first
    const iconScore = calculateIconScore(node);
    
    // Check if current node is an icon
    if ('fills' in node && 
        iconScore.total >= defaultConfig.scoreThresholds.minimum && 
        isLikelyIcon(node)) {
      try {
        const role = determineIconRole(node);
        const result = analyzeIconContrast(node, {
          id: node.id + '_icon_contrast',
          nodeId: node.id,
          nodeName: node.name,
          type: 'icon_contrast',
          category: 'Accessibility',
          title: `Icon Contrast - ${role}`,
          description: `Checking contrast ratio for ${role} icon`,
          severity: 'medium',
          role,
          colors: [],
          backgroundColor: { r: 1, g: 1, b: 1 },
          contrastRatio: 0,
          requiredRatio: 0,
          failingColors: [],
          isCompliant: false,
          recommendations: []
        });
        
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error('Error analyzing icon contrast:', node.name, error);
      }
      return; // Skip checking children since this is an icon unit
    }

    // If this wasn't an icon, recursively check children
    if ('children' in node) {
      for (const child of node.children) {
        try {
          traverseNodesForIcons(child, results);
        } catch (error) {
          console.error('Error traversing child node:', child.name, error);
          continue; // Continue with next child even if one fails
        }
      }
    }
  } catch (error) {
    console.error('Error traversing node:', node.name, error);
  }
}

// Helper to check if node is likely an icon
function isLikelyIcon(node: SceneNode): boolean {
  // Skip text nodes entirely
  if (node.type === 'TEXT') {
    return false;
  }

  // Skip if node has text content
  if ('characters' in node && typeof node.characters === 'string' && node.characters.trim().length > 0) {
    return false;
  }

  // Skip buttons (they're handled by button contrast)
  const isButton = 
    node.name.toLowerCase().includes('button') || 
    node.name.toLowerCase().includes('btn') ||
    ('role' in node && node.role === 'button');
  
  if (isButton) {
    return false;
  }

  // Skip if size is too large (icons are typically small)
  if ('width' in node && 'height' in node) {
    const maxSize = Math.max(node.width, node.height);
    if (maxSize > 64) { // Most icons are 64px or smaller
      return false;
    }
  }

  // Check if node has vector properties typical of icons
  const hasVectorProperties = 
    node.type === 'VECTOR' ||
    node.type === 'STAR' ||
    node.type === 'ELLIPSE' ||
    node.type === 'POLYGON' ||
    ('vectorNetwork' in node) ||
    ('vectorPaths' in node);

  // If this node has vector properties, it might be part of a larger icon
  // Let's check if the parent is also icon-like
  if (hasVectorProperties && node.parent && 'type' in node.parent && isLikelyIcon(node.parent as SceneNode)) {
    return false; // Skip this node as it's part of a parent icon
  }

  // Either this node has vector properties and no icon-like parent,
  // or it's a container (frame/group) that might contain icon parts
  return hasVectorProperties || 
         (('children' in node) && node.type !== 'INSTANCE'); // Allow frames/groups but not instances
}

// Export utilities for testing
export const __testing = {
  isIconNode,
  determineIconRole,
  findOpaqueBackground,
  calculateContrastRatio,
  extractAllIconColors,
  generateIconRecommendations,
  analyzeIconContrast,
  blendWithBackground,
  isLikelyIcon
};

// Export public API
export { 
  isIconNode,
  isIconByName,
  isIconByType,
  isIconBySize,
  isIconByContext,
  determineIconRole,
  generateIconRecommendations
};
