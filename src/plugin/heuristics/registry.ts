import { HeuristicDefinition, HeuristicResult } from './types';
import { evaluateTextContrast } from './contrast';
import { evaluateIconContrast, generateIconRecommendations } from './iconContrast';

export const heuristicChecks: HeuristicDefinition[] = [
  {
    id: 'text-contrast',
    name: 'Text Contrast',
    description: 'Checks if text elements have sufficient contrast with their background',
    category: 'Color Contrast',
    check: async (node: SceneNode) => {
      const results = await evaluateTextContrast(node);
      return results.map(issue => ({
        id: `text-${node.id}-${issue.nodeId}`,
        type: 'text-contrast',
        ...issue,
        category: 'Color Contrast',
        title: 'Insufficient Text Contrast',
        description: `Text contrast ratio is ${issue.contrastRatio?.toFixed(2)}:1 (required ≥${issue.requiredRatio}:1)`,
        severity: (issue.contrastRatio && issue.contrastRatio < issue.requiredRatio! * 0.5) ? 'high' : 'medium'
      }));
    }
  },
  {
    id: 'icon-contrast',
    name: 'Icon Contrast',
    description: 'Checks if icons have sufficient contrast with their background',
    category: 'Color Contrast',
    check: async (node: SceneNode) => {
      const results: HeuristicResult[] = [];

      // Helper function to recursively check nodes
      async function checkNode(node: SceneNode) {
        // Skip if node is hidden
        if ('visible' in node && !node.visible) {
          return;
        }

        // Check if any parent is hidden
        let parent = node.parent;
        while (parent) {
          if ('visible' in parent && !parent.visible) {
            return;
          }
          parent = parent.parent;
        }

        // Check if this node is an icon first
        const result = await evaluateIconContrast(node);
        if (result && !result.isCompliant) {
          results.push({
            id: `icon-${node.id}`,
            type: 'icon-contrast',
            nodeId: result.nodeId,
            nodeName: result.nodeName,
            category: 'Color Contrast',
            title: 'Insufficient Icon Contrast',
            description: `Icon contrast ratio is ${result.contrastRatio.toFixed(2)}:1 (required ≥${result.requiredRatio}:1 for ${result.role} icons)`,
            severity: (() => {
              const ratio = result.contrastRatio;
              switch (result.role) {
                case 'interactive':
                  if (ratio < 3.0) return 'high';
                  if (ratio < 4.5) return 'medium';
                  return 'low';
                case 'informative':
                  if (ratio < 2.0) return 'high';
                  if (ratio < 3.0) return 'medium';
                  return 'low';
                case 'decorative':
                  if (ratio < 2.0) return 'medium';
                  return 'low';
              }
            })(),
            role: result.role,
            colors: result.colors.map(color => ({
              original: `rgb(${Math.round(color.original.r * 255)}, ${Math.round(color.original.g * 255)}, ${Math.round(color.original.b * 255)})`,
              blended: `rgb(${Math.round(color.blended.r * 255)}, ${Math.round(color.blended.g * 255)}, ${Math.round(color.blended.b * 255)})`,
              coverage: 1,
              contrastRatio: color.contrastRatio
            })),
            recommendations: generateIconRecommendations(
              result.contrastRatio,
              result.requiredRatio,
              result.role,
              result.colors,
              result.backgroundColor
            ),
            failingColors: result.failingColors?.map(color => 
              `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`
            ),
            isCompliant: result.isCompliant
          });
        }

        // Only check children if this node is not an icon itself
        if (!result && 'children' in node) {
          for (const child of node.children) {
            await checkNode(child);
          }
        }
      }

      // Start recursive check from the root node
      await checkNode(node);
      return results;
    }
  }
];
