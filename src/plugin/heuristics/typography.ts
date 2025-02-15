import { HeuristicResult } from './types';
import { TypographyValidator } from './typography/typography';
import { TextNodeWithStyle } from './typography/shared';

// Initialize typography validator
const typographyValidator = new TypographyValidator();

/**
 * Collects all text nodes from a node and its children
 */
function collectTextNodes(node: SceneNode): TextNode[] {
  const textNodes: TextNode[] = [];

  function traverse(node: SceneNode) {
    if (node.type === 'TEXT') {
      textNodes.push(node);
    }
    if ('children' in node) {
      node.children.forEach(traverse);
    }
  }

  traverse(node);
  return textNodes;
}

/**
 * Evaluates typography in the design
 */
export async function evaluateTypography(node: SceneNode): Promise<HeuristicResult[]> {
  // Collect all text nodes
  const textNodes = collectTextNodes(node);
  
  if (textNodes.length === 0) {
    return [];
  }

  // Validate typography for all text nodes
  const validationResults = await typographyValidator.validateBatch(textNodes);
  
  // Convert validation results to heuristic results
  return validationResults.flatMap(result => 
    result.issues.map(issue => ({
      id: `typography-${issue.code}-${issue.node.id}`,
      nodeId: issue.node.id,
      nodeName: issue.node.name,
      type: 'typography',
      category: 'Typography',
      title: `Typography ${issue.type}`,
      description: issue.message,
      severity: issue.severity === 'error' ? 'high' : issue.severity === 'warning' ? 'medium' : 'low',
      suggestion: issue.suggestion,
      expectedValue: issue.expected,
      actualValue: issue.actual,
      confidence: result.confidence,
      recommendations: [issue.suggestion].filter(Boolean) as string[]
    }))
  );
}
