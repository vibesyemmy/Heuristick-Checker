import { IconContrastHeuristicResult, FigmaColor } from './types';
import { defaultConfig } from './config';
import { isIconNode, isIconByName, isIconByType, isIconBySize, isIconByShape, isIconByContext, determineIconRole, calculateIconScore } from './iconDetection';
import { blendWithBackground, calculateContrastRatio } from './colorUtils';

// Types
type IconRole = 'interactive' | 'informative' | 'decorative';

interface ColorWithOpacity {
  color: FigmaColor;
  fillOpacity: number;
  layerOpacity: number;
  effectiveOpacity: number;
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
 * @property {Object[]} colors - Array of colors used in the icon with their contrast ratios.
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
          effectiveOpacity: result.a
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
        effectiveOpacity: opacity
      };
    }
  }

  // Fallback to white only if canvas background is not available
  return {
    color: { r: 1, g: 1, b: 1, a: 1 },
    fillOpacity: 1,
    layerOpacity: 1,
    effectiveOpacity: 1
  };
}

// Extract colors from a node considering opacity
function extractAllIconColors(node: SceneNode, parentOpacity: number = 1): ColorWithOpacity[] {
  const colors: ColorWithOpacity[] = [];
  
  // Calculate effective opacity for this node
  let nodeOpacity = 1;
  
  // Handle opacity based on node type
  if ('opacity' in node && typeof node.opacity === 'number') {
    nodeOpacity = node.opacity;
  } else if ('visible' in node) {
    nodeOpacity = node.visible ? 1 : 0;
  }
  
  // Special handling for BOOLEAN_OPERATION and VECTOR nodes
  if (node.type === 'BOOLEAN_OPERATION' || node.type === 'VECTOR') {
    // For these nodes, we need to check the parent for opacity
    const parent = node.parent;
    if (parent && 'opacity' in parent && typeof parent.opacity === 'number') {
      nodeOpacity = parent.opacity;
    }
  }
  
  // Ensure opacity is a number and clamp between 0 and 1
  nodeOpacity = Math.max(0, Math.min(1, nodeOpacity));
  
  const effectiveParentOpacity = parentOpacity * nodeOpacity;

  // Debug log
  console.log('Node:', {
    name: node.name,
    type: node.type,
    nodeOpacity,
    parentOpacity,
    effectiveParentOpacity,
    parent: node.parent?.name,
    parentType: node.parent?.type
  });

  // Handle fills
  if ('fills' in node) {
    const fills = Array.isArray(node.fills) ? node.fills : [];
    for (const fill of fills) {
      if (fill.type === 'SOLID' && fill.visible) {
        const fillOpacity = typeof fill.opacity === 'number' ? Math.max(0, Math.min(1, fill.opacity)) : 1;
        const effectiveOpacity = effectiveParentOpacity * fillOpacity;
        
        // Debug log
        console.log('Fill:', {
          type: fill.type,
          visible: fill.visible,
          opacity: fill.opacity,
          color: fill.color,
          fillOpacity,
          effectiveOpacity
        });
        
        colors.push({
          color: { 
            ...fill.color,
            a: 1 // Keep original alpha, handle opacity separately
          },
          fillOpacity,
          layerOpacity: effectiveParentOpacity,
          effectiveOpacity
        });
      }
    }
  }

  // Recursively process children with cascaded opacity
  if ('children' in node) {
    for (const child of node.children) {
      colors.push(...extractAllIconColors(child, effectiveParentOpacity));
    }
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
export function analyzeIconContrast(node: SceneNode, result: IconContrastHeuristicResult): IconContrastHeuristicResult | null {
  try {
    // Find opaque background
    const background = findOpaqueBackground(node);
    if (!background) {
      result.recommendations.push('No opaque background found. Consider adding a background color.');
      return result;
    }

    // Extract icon colors with opacity
    const iconColors = extractAllIconColors(node);
    if (iconColors.length === 0) {
      result.recommendations.push('No visible colors found in icon.');
      return result;
    }

    // Debug log
    console.log('Analyzing icon colors:', iconColors);
    console.log('Background:', background);

    // Calculate contrast for each color
    const failingColors: FigmaColor[] = [];
    const colors: { 
      original: FigmaColor; 
      blended: FigmaColor; 
      effectiveOpacity: number; 
      contrastRatio: number 
    }[] = [];
    let minContrastRatio = Infinity;

    for (const { color, effectiveOpacity } of iconColors) {
      // Debug log
      console.log('Processing color:', color, 'with effectiveOpacity:', effectiveOpacity);

      // Blend with background using effective opacity
      const blendedColor = blendWithBackground(
        color, // Original color without opacity
        background.color,
        effectiveOpacity // Use effective opacity for blending
      );

      // Debug log
      console.log('Blended color:', blendedColor);

      // Calculate contrast with background
      const contrastRatio = calculateContrastRatio(blendedColor, background.color);

      // Debug log
      console.log('Contrast ratio:', contrastRatio);

      colors.push({
        original: color,
        blended: blendedColor,
        effectiveOpacity,
        contrastRatio
      });

      if (contrastRatio < minContrastRatio) {
        minContrastRatio = contrastRatio;
      }

      // Check if color fails contrast requirements
      const requiredRatio = getRequiredContrastRatio(result.role);
      if (contrastRatio < requiredRatio) {
        failingColors.push(color);
      }
    }

    // Update result
    result.colors = colors;
    result.backgroundColor = background.color;
    result.contrastRatio = minContrastRatio;
    result.requiredRatio = getRequiredContrastRatio(result.role);
    result.isCompliant = failingColors.length === 0;
    result.failingColors = failingColors;

    // Calculate severity based on the worst contrast ratio
    result.severity = calculateSeverity(minContrastRatio, result.requiredRatio);

    // Generate recommendations
    if (!result.isCompliant) {
      result.recommendations = generateIconRecommendations(minContrastRatio, result.requiredRatio, result.role);
    }

    return result;
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
export function evaluateIconContrast(node: SceneNode): IconContrastHeuristicResult[] {
  const results: IconContrastHeuristicResult[] = [];
  traverseNodesForIcons(node, results);
  
  // Filter out passing results
  return results.filter(result => {
    const requiredRatio = getRequiredContrastRatio(result.role);
    return result.contrastRatio < requiredRatio;
  });
}

// Recursive traversal function
function traverseNodesForIcons(node: SceneNode, results: IconContrastHeuristicResult[]) {
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
    const iconScore = calculateIconScore(node, defaultConfig);
    
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
          // Only add the result if it fails the contrast check
          const requiredRatio = getRequiredContrastRatio(result.role);
          if (result.contrastRatio < requiredRatio) {
            results.push(result);
          }
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
  isIconByShape,
  isIconByContext,
  determineIconRole,
  generateIconRecommendations
};
