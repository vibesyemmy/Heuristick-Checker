import { HeuristicResult } from './types';
import { generateUUID } from '../utils/uuid';

// Define expected states for different interactive elements
const EXPECTED_STATES = {
  BUTTON: ['default', 'hover', 'active', 'disabled'],
  LINK: ['default', 'hover', 'visited'],
  INPUT: ['default', 'focus', 'disabled'],
  TAB: ['default', 'selected', 'hover'],
  TOGGLE: ['on', 'off', 'hover'],
  CHECKBOX: ['unchecked', 'checked', 'hover'],
  RADIO: ['unselected', 'selected', 'hover'],
} as const;

// Define types for RGB colors with alpha
interface RGBWithAlpha extends RGB {
  a: number;
}

// Define types for state relationships
interface StateRelationship {
  from: string;
  to: string;
  minRatio: number;
}

type ElementStateRelationships = {
  [K in keyof typeof EXPECTED_STATES]: readonly StateRelationship[];
};

// Define state relationships to check
const STATE_RELATIONSHIPS: ElementStateRelationships = {
  BUTTON: [
    { from: 'default', to: 'hover', minRatio: 1.5 },
    { from: 'default', to: 'active', minRatio: 1.5 },
    { from: 'default', to: 'disabled', minRatio: 2 },
    { from: 'hover', to: 'active', minRatio: 1.2 }
  ],
  LINK: [
    { from: 'default', to: 'hover', minRatio: 1.5 },
    { from: 'default', to: 'visited', minRatio: 1.3 }
  ],
  INPUT: [
    { from: 'default', to: 'focus', minRatio: 1.5 },
    { from: 'default', to: 'disabled', minRatio: 2 }
  ],
  TAB: [
    { from: 'default', to: 'selected', minRatio: 2 },
    { from: 'default', to: 'hover', minRatio: 1.5 }
  ],
  TOGGLE: [
    { from: 'off', to: 'on', minRatio: 2 },
    { from: 'off', to: 'hover', minRatio: 1.5 }
  ],
  CHECKBOX: [
    { from: 'unchecked', to: 'checked', minRatio: 2 },
    { from: 'unchecked', to: 'hover', minRatio: 1.5 }
  ],
  RADIO: [
    { from: 'unselected', to: 'selected', minRatio: 2 },
    { from: 'unselected', to: 'hover', minRatio: 1.5 }
  ]
} as const;

// Interface for contrast analysis results
interface MissingStateIssue {
  type: 'missing-state';
  missingState: string;
  message: string;
}

interface ContrastStateIssue {
  type: 'contrast-issue';
  states: [string, string];
  contrastRatio: number;
  requiredRatio: number;
  message: string;
}

type StateContrastIssue = MissingStateIssue | ContrastStateIssue;

interface StateAnalysisResult {
  elementType: string;
  elementName: string;
  availableStates: string[];
  missingStates: string[];
  issues: StateContrastIssue[];
}

// Helper function to determine if a node is an interactive element
async function isInteractiveElement(node: SceneNode): Promise<boolean> {
  if (node.type !== 'INSTANCE') return false;
  
  try {
    // Check node name for common interactive element keywords
    const interactiveKeywords = ['button', 'link', 'input', 'tab', 'toggle', 'checkbox', 'radio'];
    const nodeName = node.name.toLowerCase();
    
    // First check the node's own name
    if (interactiveKeywords.some(keyword => nodeName.includes(keyword))) {
      return true;
    }

    // Check component properties if they exist
    if ('componentProperties' in node) {
      const propertyNames = Object.keys(node.componentProperties).map(name => name.toLowerCase());
      // Look for properties that suggest interactivity
      const interactiveProps = ['onclick', 'click', 'press', 'hover', 'active', 'focus', 'disabled'];
      if (propertyNames.some(prop => interactiveProps.some(keyword => prop.includes(keyword)))) {
        return true;
      }
    }

    // Check variant properties
    if ('variantProperties' in node) {
      const variantProps = node.variantProperties;
      if (variantProps) {
        const propNames = Object.keys(variantProps).map(name => name.toLowerCase());
        // Look for variant properties that suggest states
        const stateProps = ['state', 'status', 'variant', 'mode'];
        if (propNames.some(prop => stateProps.some(keyword => prop.includes(keyword)))) {
          return true;
        }
      }
    }

    // Check if it's a component with states
    const mainComponent = await getMainComponent(node);
    if (mainComponent?.parent?.type === 'COMPONENT_SET') {
      // If it's part of a component set, it likely has states
      return true;
    }

    return false;
  } catch (error) {
    console.warn('Error checking if element is interactive:', error);
    return false;
  }
}

// Helper function to traverse node and find interactive elements
async function findInteractiveElements(node: SceneNode): Promise<InstanceNode[]> {
  const interactiveElements: InstanceNode[] = [];

  // Check if current node is interactive
  if (node.type === 'INSTANCE' && await isInteractiveElement(node)) {
    interactiveElements.push(node);
  }

  // Recursively check children if they exist
  if ('children' in node) {
    for (const child of node.children) {
      interactiveElements.push(...await findInteractiveElements(child));
    }
  }

  return interactiveElements;
}

// Helper function to safely get main component
async function getMainComponent(node: InstanceNode): Promise<ComponentNode | null> {
  try {
    // Try async method first
    try {
      return await node.getMainComponentAsync();
    } catch (asyncError) {
      console.warn('Async main component access failed:', asyncError);
      // Fall back to sync access
      return node.mainComponent;
    }
  } catch (error) {
    console.warn('Failed to get main component:', error);
    return null;
  }
}

// Helper function to safely get component set children
async function getComponentSetChildren(node: InstanceNode): Promise<ComponentNode[]> {
  try {
    if (!node) {
      console.warn('No node provided to getComponentSetChildren');
      return [];
    }

    const mainComponent = await getMainComponent(node);
    if (!mainComponent) {
      console.warn('No main component found for node:', node.name);
      return [];
    }

    // Get parent component set
    const componentSet = mainComponent.parent;
    if (!componentSet || componentSet.type !== 'COMPONENT_SET') {
      console.warn('Parent is not a component set:', componentSet?.type);
      return [];
    }

    // Filter and validate children
    return componentSet.children
      .filter((child): child is ComponentNode => 
        child && 
        child.type === 'COMPONENT' && 
        !child.removed && 
        child.visible !== false);

  } catch (error) {
    console.warn('Error accessing component set children:', error);
    return [];
  }
}

// Helper function to check if node has proper variant setup
async function hasProperVariantSetup(node: InstanceNode): Promise<boolean> {
  try {
    const mainComponent = await getMainComponent(node);
    if (!mainComponent?.parent) return false;
    
    return mainComponent.parent.type === 'COMPONENT_SET';
  } catch (error) {
    console.error('Error checking variant setup:', error);
    return false;
  }
}

// Helper function to get state from node properties
function getStateFromProperties(node: BaseNode & ChildrenMixin): string | null {
  try {
    // Try variant properties first if it's a component
    if ('variantProperties' in node) {
      const variantState = getStateFromVariantProperties(node as ComponentNode);
      if (variantState) return variantState;
    }

    // Try component properties if it's an instance
    if ('componentProperties' in node) {
      const stateProps = ['State', 'state', 'STATUS', 'status'];
      for (const prop of stateProps) {
        const value = (node as InstanceNode).componentProperties[prop]?.value;
        if (value && typeof value === 'string') {
          return value.toLowerCase();
        }
      }
    }

    // Fallback to name parsing
    return getStateFromName(node);
  } catch (error) {
    console.warn('Error getting state from properties:', error);
    return null;
  }
}

// Helper function to get state from name
function getStateFromName(node: BaseNode): string | null {
  try {
    const nameParts = node.name.toLowerCase().split(/[=,]/);
    // Look for state-like terms in the name
    const stateKeywords = ['state', 'status', 'variant'];
    
    for (let i = 0; i < nameParts.length - 1; i++) {
      if (stateKeywords.some(keyword => nameParts[i].includes(keyword))) {
        return nameParts[i + 1].trim();
      }
    }
    
    // If no explicit state marker found, return the last part
    return nameParts[nameParts.length - 1].trim();
  } catch (error) {
    console.warn('Error parsing node name:', error);
    return null;
  }
}

// Helper function to safely get variant properties
function getStateFromVariantProperties(node: ComponentNode): string | null {
  try {
    // Basic validation
    if (!node || !('variantProperties' in node)) {
      return null;
    }

    // Safely access variant properties
    const variantProps = node.variantProperties;
    if (!variantProps || typeof variantProps !== 'object') {
      return null;
    }

    // Try different property names
    const possibleProps = ['State', 'state', 'STATUS', 'status'];
    for (const prop of possibleProps) {
      const value = variantProps[prop];
      if (value && typeof value === 'string') {
        return value.toLowerCase();
      }
    }

    return null;
  } catch (error) {
    console.warn('Error accessing variant properties:', error);
    return null;
  }
}

// Helper function to get available states from a component
async function getAvailableStates(node: InstanceNode): Promise<string[]> {
  try {
    // Get component set children safely
    const components = await getComponentSetChildren(node);
    if (components.length === 0) {
      // If we can't get component set children, try to get state from the instance itself
      const instanceState = getStateFromProperties(node);
      return instanceState ? [instanceState] : [];
    }

    const states = new Set<string>();

    // Process each component
    components.forEach(component => {
      try {
        const state = getStateFromProperties(component);
        if (state) {
          states.add(state);
        }
      } catch (componentError) {
        console.warn('Error processing component:', componentError);
      }
    });

    return Array.from(states);
  } catch (error) {
    console.error('Error getting available states:', error);
    return [];
  }
}

// Helper function to find missing states based on element type
function findMissingStates(elementType: keyof typeof EXPECTED_STATES, availableStates: string[]): string[] {
  const expectedStates = EXPECTED_STATES[elementType];
  if (!expectedStates) return [];
  
  return expectedStates.filter(
    state => !availableStates.some(state => state.includes(state))
  );
}

// Helper function to get fill color from a node
function getNodeFillColor(node: ComponentNode): RGB | null {
  const fills = node.fills as readonly Paint[];
  if (!fills || fills.length === 0) return null;

  const solidFill = fills.find(fill => fill.type === 'SOLID');
  if (!solidFill || solidFill.type !== 'SOLID') return null;

  return solidFill.color;
}

// Interface for visual properties
interface VisualProperties {
  fills: RGBWithAlpha[];
  strokes: RGBWithAlpha[];
  effects: RGBWithAlpha[];
  opacity: number;
}

function getNodeVisualProperties(node: ComponentNode): VisualProperties {
  const props: VisualProperties = {
    fills: [],
    strokes: [],
    effects: [],
    opacity: node.opacity || 1
  };

  // Get fills
  if (node.fills) {
    (node.fills as Paint[]).forEach(fill => {
      if (fill.type === 'SOLID' && fill.visible) {
        props.fills.push({
          ...fill.color,
          a: (fill.opacity || 1) * props.opacity
        } as RGBWithAlpha);
      }
    });
  }

  // Get strokes
  if (node.strokes) {
    (node.strokes as Paint[]).forEach(stroke => {
      if (stroke.type === 'SOLID' && stroke.visible) {
        props.strokes.push({
          ...stroke.color,
          a: (stroke.opacity || 1) * props.opacity
        } as RGBWithAlpha);
      }
    });
  }

  // Get effects
  if (node.effects) {
    node.effects.forEach(effect => {
      if ((effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') && effect.visible) {
        props.effects.push({
          ...effect.color,
          a: (effect.color.a || 1) * props.opacity
        } as RGBWithAlpha);
      }
    });
  }

  return props;
}

// Helper function to calculate overall visual difference
function calculateVisualDifference(propsA: VisualProperties, propsB: VisualProperties): number {
  let maxDifference = 0;

  // Compare fills
  propsA.fills.forEach(fillA => {
    propsB.fills.forEach(fillB => {
      const ratio = calculateContrastRatio(fillA, fillB);
      maxDifference = Math.max(maxDifference, ratio);
    });
  });

  // Compare strokes
  propsA.strokes.forEach(strokeA => {
    propsB.strokes.forEach(strokeB => {
      const ratio = calculateContrastRatio(strokeA, strokeB);
      maxDifference = Math.max(maxDifference, ratio);
    });
  });

  // Compare effects
  propsA.effects.forEach(effectA => {
    propsB.effects.forEach(effectB => {
      const ratio = calculateContrastRatio(effectA, effectB);
      maxDifference = Math.max(maxDifference, ratio);
    });
  });

  return maxDifference || 1; // Return 1 if no differences found
}

// Helper function to analyze contrast between two states
function compareStateContrast(stateA: ComponentNode, stateB: ComponentNode, requiredRatio: number): StateContrastIssue | null {
  const propsA = getNodeVisualProperties(stateA);
  const propsB = getNodeVisualProperties(stateB);
  
  const visualDifference = calculateVisualDifference(propsA, propsB);
  
  if (visualDifference < requiredRatio) {
    return {
      type: 'contrast-issue',
      states: [stateA.name, stateB.name],
      contrastRatio: visualDifference,
      requiredRatio,
      message: `Low visual contrast (${visualDifference.toFixed(2)}:1) between ${stateA.name} and ${stateB.name} states. Aim for at least ${requiredRatio}:1.`
    };
  }
  
  return null;
}

// Helper function to calculate contrast ratio between two colors
function calculateContrastRatio(colorA: RGBWithAlpha, colorB: RGBWithAlpha): number {
  const luminanceA = calculateRelativeLuminance(colorA);
  const luminanceB = calculateRelativeLuminance(colorB);
  
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  
  return (lighter + 0.05) / (darker + 0.05);
}

// Helper function to calculate relative luminance
function calculateRelativeLuminance(color: RGBWithAlpha): number {
  const { r, g, b } = color;
  const [rs, gs, bs] = [r, g, b].map(c => {
    const sRGB = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return sRGB;
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Helper function to determine element type from node
function getElementType(node: SceneNode): keyof typeof EXPECTED_STATES | null {
  const nodeName = node.name.toLowerCase();
  
  for (const type of Object.keys(EXPECTED_STATES) as Array<keyof typeof EXPECTED_STATES>) {
    if (nodeName.includes(type.toLowerCase())) {
      return type;
    }
  }
  
  return null;
}

// Helper function to format state name for display
function formatStateName(state: string): string {
  // Remove common prefixes
  state = state.replace(/(type|state|style|spinner|icon)=/gi, '');
  // Clean up the state name
  return state.split(/[-_,\s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Helper function to format contrast ratio
function formatContrastRatio(ratio: number): string {
  return ratio.toFixed(1);
}

// Helper function to format recommendations for an element
function formatElementRecommendations(elementName: string, issues: StateContrastIssue[]): string[] {
  const recommendations: string[] = [];
  
  // Group issues by type
  const missingStates = issues.filter((i): i is MissingStateIssue => i.type === 'missing-state');
  const contrastIssues = issues.filter((i): i is ContrastStateIssue => i.type === 'contrast-issue');

  // Format missing states
  if (missingStates.length > 0) {
    recommendations.push(`[${elementName}]`);
    missingStates.forEach(issue => {
      recommendations.push(`  • Add ${formatStateName(issue.missingState)} state`);
    });
  }

  // Format contrast issues
  if (contrastIssues.length > 0) {
    if (missingStates.length === 0) {
      recommendations.push(`[${elementName}]`);
    }
    contrastIssues.forEach(issue => {
      const fromState = formatStateName(issue.states[0]);
      const toState = formatStateName(issue.states[1]);
      const current = formatContrastRatio(issue.contrastRatio);
      const required = formatContrastRatio(issue.requiredRatio);
      recommendations.push(`  • Increase contrast: ${fromState} → ${toState} (${current}:1, needs ${required}:1)`);
    });
  }

  return recommendations;
}

// Main analysis function
export async function analyzeStateContrast(node: SceneNode): Promise<HeuristicResult[] | null> {
  try {
    // Find all interactive elements in the node
    const interactiveElements = await findInteractiveElements(node);
    
    if (interactiveElements.length === 0) {
      return null;
    }

    // Analyze each interactive element
    const results: HeuristicResult[] = [];

    for (const element of interactiveElements) {
      const elementType = getElementType(element);
      if (!elementType) continue;

      const issues: StateContrastIssue[] = [];
      const availableStates = await getAvailableStates(element);
      
      if (availableStates.length === 0) {
        // Try to get the current state
        const currentState = getStateFromProperties(element);
        if (!currentState) continue;

        // Check if this is the default state
        if (!currentState.includes('default') && !currentState.includes('normal')) {
          issues.push({
            type: 'missing-state',
            missingState: 'default',
            message: `Missing default state for ${elementType}. Current state is "${currentState}"`
          });
        }
      } else {
        // Check for missing states
        const expectedStates = EXPECTED_STATES[elementType];
        if (!expectedStates) continue;
        
        // Add missing states to issues
        for (const expectedState of expectedStates) {
          if (!availableStates.some(state => state.includes(expectedState))) {
            issues.push({
              type: 'missing-state',
              missingState: expectedState,
              message: `Missing ${expectedState} state for ${elementType}`
            });
          }
        }
      }

      // Get components for contrast checking
      const components = await getComponentSetChildren(element);
      
      if (components.length === 0) {
        const currentState = getStateFromProperties(element);
        if (currentState) {
          issues.push({
            type: 'missing-state',
            missingState: 'contrast-check',
            message: `Unable to check state contrast - component "${element.name}" is on a dynamic page. Consider moving it to the main page for a complete check.`
          });
        }
      } else {
        // Compare states using relationships
        const relationships = STATE_RELATIONSHIPS[elementType] || [];
        relationships.forEach(({ from, to, minRatio }) => {
          try {
            const fromState = components.find(c => {
              const state = getStateFromProperties(c);
              return state?.includes(from);
            });
            
            const toState = components.find(c => {
              const state = getStateFromProperties(c);
              return state?.includes(to);
            });
            
            if (fromState && toState) {
              const contrastIssue = compareStateContrast(fromState, toState, minRatio);
              if (contrastIssue) {
                issues.push(contrastIssue);
              }
            }
          } catch (relationshipError) {
            console.warn('Error comparing states:', relationshipError);
          }
        });
      }

      if (issues.length > 0) {
        // Format recommendations for this element
        const recommendations = formatElementRecommendations(element.name, issues);

        // Calculate severity based on contrast issues for this element
        const contrastIssues = issues.filter((i): i is ContrastStateIssue => i.type === 'contrast-issue');
        const worstContrastRatio = contrastIssues.length > 0
          ? Math.min(...contrastIssues.map(i => i.contrastRatio / i.requiredRatio))
          : 1;

        results.push({
          id: generateUUID(),
          type: 'state-contrast',
          category: 'Interactive States',
          title: `State Contrast Issues - ${element.name}`,
          description: `Found ${issues.length} state contrast issues`,
          severity: worstContrastRatio < 0.5 ? 'high' : worstContrastRatio < 0.8 ? 'medium' : 'low',
          recommendations,
          nodeId: element.id,
          nodeName: element.name,
          ...(contrastIssues.length > 0 && {
            contrastRatio: Math.min(...contrastIssues.map(i => i.contrastRatio)),
            requiredRatio: Math.max(...contrastIssues.map(i => i.requiredRatio))
          })
        });
      }
    }

    return results.length > 0 ? results : null;

  } catch (error) {
    console.error('Error in state contrast analysis:', error);
    return null;
  }
}
