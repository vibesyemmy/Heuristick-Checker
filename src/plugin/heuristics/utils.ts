/**
 * Gets the opacity of a fill
 * @param fill - The fill to get opacity from
 * @returns The opacity value between 0 and 1
 */
export function getNodeFillOpacity(fill: Paint): number {
  if ('opacity' in fill && typeof fill.opacity === 'number') {
    return Math.max(0, Math.min(1, fill.opacity));
  }
  return 1;
}

/**
 * Gets the layer opacity of a node
 * @param node - The node to get opacity from
 * @returns The opacity value between 0 and 1
 */
export function getNodeLayerOpacity(node: BaseNode & { opacity?: number }): number {
  if ('opacity' in node && typeof node.opacity === 'number') {
    return Math.max(0, Math.min(1, node.opacity));
  }
  return 1;
}

/**
 * Gets the effective opacity for a node, combining layer and fill opacity
 * @param node - The node to get opacity from
 * @param fill - Optional fill to include in opacity calculation
 * @returns The combined opacity value between 0 and 1
 */
export function getEffectiveOpacity(node: BaseNode & { opacity?: number }, fill?: Paint): number {
  const layerOpacity = getNodeLayerOpacity(node);
  const fillOpacity = fill ? getNodeFillOpacity(fill) : 1;
  return layerOpacity * fillOpacity;
}

/**
 * Determines if a node is likely to be a button
 * @param node - The node to check
 * @returns boolean indicating if the node is a button
 */
export async function isInteractiveComponent(node: SceneNode): Promise<boolean> {
  const nodeName = node.name.toLowerCase();
  const interactiveKeywords = ['button', 'link', 'input', 'tab', 'toggle', 'checkbox', 'radio'];
  
  // Check if node name contains interactive keywords
  if (interactiveKeywords.some(keyword => nodeName.includes(keyword))) {
    return true;
  }
  
  // Check if it's an instance of an interactive component
  if (node.type === 'INSTANCE') {
    try {
      const mainComponent = await node.getMainComponentAsync();
      if (mainComponent) {
        const mainComponentName = mainComponent.name.toLowerCase();
        return interactiveKeywords.some(keyword => mainComponentName.includes(keyword));
      }
    } catch (error) {
      console.error('Error getting main component:', error);
    }
  }
  
  return false;
}
