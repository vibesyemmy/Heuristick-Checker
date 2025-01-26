import { IconDetectionConfig } from './types';

export interface IconDetectionScore {
  nameScore: number;
  typeScore: number;
  sizeScore: number;
  shapeScore: number;
  contextScore: number;
  total: number;
}

export function isIconNode(node: SceneNode): boolean {
  // Skip hidden nodes
  if ('visible' in node && !node.visible) {
    return false;
  }

  // Skip text nodes
  if (node.type === 'TEXT') {
    return false;
  }

  // Check individual criteria
  const byName = isIconByName(node);
  const byType = isIconByType(node);
  const bySize = isIconBySize(node);
  const byShape = isIconByShape(node);
  const byContext = isIconByContext(node);

  // Return true if any of the criteria match
  return byName || byType || bySize || byShape || byContext;
}

export function isIconByName(node: SceneNode): boolean {
  const name = node.name.toLowerCase();
  return /icon|ico|glyph|symbol/i.test(name);
}

export function isIconByType(node: SceneNode): boolean {
  return node.type === 'VECTOR' || 
         node.type === 'STAR' || 
         node.type === 'ELLIPSE' || 
         node.type === 'POLYGON' ||
         node.type === 'BOOLEAN_OPERATION';
}

export function isIconBySize(node: SceneNode): boolean {
  if ('width' in node && 'height' in node) {
    const maxDimension = Math.max(node.width, node.height);
    const minDimension = Math.min(node.width, node.height);
    const aspectRatio = maxDimension / minDimension;
    return maxDimension <= 64 && minDimension >= 12 && aspectRatio <= 1.5;
  }
  return false;
}

export function isIconByShape(node: SceneNode): boolean {
  return node.type === 'VECTOR' || 
         node.type === 'STAR' || 
         node.type === 'ELLIPSE' || 
         node.type === 'POLYGON' || 
         node.type === 'BOOLEAN_OPERATION';
}

export function isIconByContext(node: SceneNode): boolean {
  try {
    // Check if node has reactions (interactive)
    if ('reactions' in node && Array.isArray(node.reactions) && node.reactions.length > 0) {
      return true;
    }

    // Check if node has onClick action
    if ('onClick' in node && node.onClick) {
      return true;
    }

    // Check if node has action property
    if ('action' in node && node.action && typeof node.action === 'object' && 'type' in node.action) {
      return true;
    }

    // Check if parent is a button or interactive component
    const parent = node.parent;
    if (parent && 'name' in parent) {
      const parentName = parent.name.toLowerCase();
      return /button|btn|interactive|clickable/i.test(parentName);
    }

    return false;
  } catch (error) {
    console.error('Error in isIconByContext:', error);
    return false;
  }
}

export function determineIconRole(node: SceneNode): 'interactive' | 'informative' | 'decorative' {
  // Check if icon has interactive properties
  if ('reactions' in node && node.reactions && node.reactions.length > 0) {
    return 'interactive';
  }

  // Check if parent is interactive
  if (node.parent && 'name' in node.parent) {
    const parentName = node.parent.name.toLowerCase();
    if (parentName.includes('button') || parentName.includes('btn') || parentName.includes('link')) {
      return 'interactive';
    }
  }

  // Check if icon is decorative
  const name = node.name.toLowerCase();
  if (name.includes('decorative') || name.includes('background') || name.includes('pattern')) {
    return 'decorative';
  }

  // Default to informative
  return 'informative';
}

export function calculateIconScore(node: SceneNode, config: IconDetectionConfig): IconDetectionScore {
  const nameScore = isIconByName(node) ? 0.3 : 0;
  const typeScore = isIconByType(node) ? 0.2 : 0;
  const sizeScore = isIconBySize(node) ? 0.2 : 0;
  const shapeScore = isIconByShape(node) ? 0.2 : 0;
  const contextScore = isIconByContext(node) ? 0.1 : 0;

  return {
    nameScore,
    typeScore,
    sizeScore,
    shapeScore,
    contextScore,
    total: nameScore + typeScore + sizeScore + shapeScore + contextScore
  };
}
