/**
 * Enhanced context analysis for typography validation
 */

export type ContainerType = 'screen' | 'section' | 'card' | 'sidebar' | 'header' | 'footer';
export type VerticalPosition = 'top' | 'middle' | 'bottom';
export type HorizontalPosition = 'left' | 'center' | 'right';

export interface ContainerContext {
  containerType: ContainerType;
  containerWidth: number;
  containerHeight: number;
  relativePosition: {
    verticalPosition: VerticalPosition;
    horizontalPosition: HorizontalPosition;
    verticalPercentage: number;  // 0-100%
    horizontalPercentage: number;  // 0-100%
  };
  isFirstChild: boolean;
  siblingCount: number;
  depthFromTop: number;  // How many parent containers deep
}

export interface VisualHierarchy {
  precedingText?: {
    role: string;
    fontSize: number;
    distance: number;  // pixels from current text
  };
  followingText?: {
    role: string;
    fontSize: number;
    distance: number;
  };
  parentComponent?: {
    type: string;
    name: string;
    isContainer: boolean;
  };
  marginTop: number;
  marginBottom: number;
  spacingRatio: number;  // relative to surrounding elements
}

export interface RoleSignal {
  role: string;
  confidence: number;
  context: {
    containerEvidence: string[];    // Why this role fits the container
    hierarchyEvidence: string[];    // Why this role fits the hierarchy
    styleEvidence: string[];        // Why this role fits the styling
    contentEvidence: string[];      // Why this role fits the content
  };
}

export class ContextAnalyzer {
  /**
   * Determine the type of container based on its name and properties
   */
  private determineContainerType(container: BaseNode): ContainerType {
    const name = container.name.toLowerCase();
    
    if (name.includes('screen') || name.includes('page')) return 'screen';
    if (name.includes('header') || name.includes('hero')) return 'header';
    if (name.includes('footer')) return 'footer';
    if (name.includes('sidebar') || name.includes('side-nav')) return 'sidebar';
    if (name.includes('card') || name.includes('box')) return 'card';
    return 'section';
  }

  /**
   * Calculate the relative position of a node within its container
   */
  private calculateRelativePosition(node: SceneNode, container: SceneNode): {
    verticalPosition: VerticalPosition;
    horizontalPosition: HorizontalPosition;
    verticalPercentage: number;
    horizontalPercentage: number;
  } {
    // Get node bounds
    const nodeY = node.y;
    const nodeX = node.x;
    
    // Calculate percentages
    const verticalPercentage = (nodeY / container.height) * 100;
    const horizontalPercentage = (nodeX / container.width) * 100;
    
    // Determine positions
    let verticalPosition: VerticalPosition = 'middle';
    if (verticalPercentage <= 33) verticalPosition = 'top';
    else if (verticalPercentage >= 66) verticalPosition = 'bottom';
    
    let horizontalPosition: HorizontalPosition = 'center';
    if (horizontalPercentage <= 33) horizontalPosition = 'left';
    else if (horizontalPercentage >= 66) horizontalPosition = 'right';
    
    return {
      verticalPosition,
      horizontalPosition,
      verticalPercentage,
      horizontalPercentage
    };
  }

  /**
   * Analyze hierarchy metrics for a node
   */
  private analyzeHierarchyMetrics(node: SceneNode & { parent: (BaseNode & ChildrenMixin) | null }): {
    isFirstChild: boolean;
    siblingCount: number;
    depthFromTop: number;
  } {
    let depth = 0;
    let current: (BaseNode & { parent: (BaseNode & ChildrenMixin) | null }) | null = node;
    let isFirst = false;
    let siblings = 0;
    
    // Traverse up to count depth and check position
    while (current && current.parent) {
      const parent = current.parent;
      
      if ('children' in parent) {
        if (!isFirst) {  // Only check first child status once
          isFirst = parent.children[0] === current;
          siblings = parent.children.length;
        }
      }
      
      depth++;
      current = parent as BaseNode & { parent: (BaseNode & ChildrenMixin) | null };
    }
    
    return {
      isFirstChild: isFirst,
      siblingCount: siblings,
      depthFromTop: depth
    };
  }

  /**
   * Find the topmost container for a node
   */
  private findTopmostContainer(node: SceneNode & { parent: (BaseNode & ChildrenMixin) | null }): SceneNode {
    let current: (BaseNode & { parent: (BaseNode & ChildrenMixin) | null }) | null = node;
    let topmost: SceneNode = node;
    
    while (current && current.parent) {
      const parent = current.parent;
      
      if ('width' in parent && 'height' in parent) {
        topmost = parent as SceneNode;
      }
      current = parent as BaseNode & { parent: (BaseNode & ChildrenMixin) | null };
    }
    
    return topmost;
  }

  /**
   * Main analysis function that combines all container context signals
   */
  public async analyzeContainer(node: SceneNode & { parent: (BaseNode & ChildrenMixin) | null }): Promise<ContainerContext> {
    const container = this.findTopmostContainer(node);
    const containerType = this.determineContainerType(container);
    const position = this.calculateRelativePosition(node as SceneNode, container);
    const hierarchy = this.analyzeHierarchyMetrics(node);
    
    return {
      containerType,
      containerWidth: container.width,
      containerHeight: container.height,
      relativePosition: position,
      ...hierarchy
    };
  }
}
