import { ButtonDetectionConfig } from '../config/buttonDetection';
import { detectButton } from './buttonDetection';

export type InteractiveElementType = 'button' | 'link' | 'input' | 'other';

export interface InteractiveElementState {
  name: string;  // e.g., 'hover', 'pressed', 'focus'
  propertyName: string;  // The actual property name in the component
}

export interface InteractiveElementResult {
  isInteractive: boolean;
  type?: InteractiveElementType;
  hasRequiredStates: boolean;
  availableStates: InteractiveElementState[];
  mainComponent?: ComponentNode;
  reasons: string[];
}

const REQUIRED_STATES = ['hover', 'pressed', 'focus'];

export async function analyzeInteractiveElement(
  node: SceneNode,
  config: ButtonDetectionConfig
): Promise<InteractiveElementResult> {
  const result: InteractiveElementResult = {
    isInteractive: false,
    hasRequiredStates: false,
    availableStates: [],
    reasons: []
  };

  // First check if it's an interactive element
  const buttonCheck = await detectButton(node, config);
  if (buttonCheck.isButton) {
    result.isInteractive = true;
    result.type = 'button';
    result.reasons.push(...buttonCheck.reasons);
  }

  // If it's not interactive, return early
  if (!result.isInteractive) {
    result.reasons.push('Not detected as an interactive element');
    return result;
  }

  // Check for required states
  if (node.type === 'INSTANCE') {
    try {
      const mainComponent = await node.getMainComponentAsync();
      if (mainComponent) {
        result.mainComponent = mainComponent;
        
        // Check component properties for state variants
        if ('componentProperties' in node) {
          const properties = Object.keys(node.componentProperties);
          const states = findStateProperties(properties);
          
          if (states.length > 0) {
            result.availableStates = states;
            result.hasRequiredStates = hasRequiredStatesCovered(states);
            result.reasons.push(`Found ${states.length} interactive states: ${states.map(s => s.name).join(', ')}`);
          } else {
            result.reasons.push('No interactive states found in component properties');
          }
        }
      } else {
        result.reasons.push('Could not access main component');
      }
    } catch (error) {
      result.reasons.push(`Error checking component states: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    result.reasons.push('Element is not an instance of a component');
  }

  return result;
}

function findStateProperties(properties: string[]): InteractiveElementState[] {
  const states: InteractiveElementState[] = [];
  
  for (const prop of properties) {
    const lowerProp = prop.toLowerCase();
    
    // Check for state-related properties
    for (const state of REQUIRED_STATES) {
      if (lowerProp.includes(state)) {
        states.push({
          name: state,
          propertyName: prop
        });
        break;
      }
    }
  }
  
  return states;
}

function hasRequiredStatesCovered(states: InteractiveElementState[]): boolean {
  const foundStates = new Set(states.map(s => s.name));
  return REQUIRED_STATES.every(state => foundStates.has(state));
}
