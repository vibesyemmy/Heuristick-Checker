import { evaluateButtonContrast } from './buttonContrast';
import { evaluateTextContrast } from './contrast';
import { evaluateIconContrast } from './iconContrast';
import { evaluateStateContrast, StateContrastResult, StateContrastIssue } from './stateContrast';
import { BUTTON_CONTRAST_REQUIREMENTS } from './utils/buttonDetection';
import { HeuristicResult, Heuristic } from './types';

export const heuristics: Heuristic[] = [
  {
    id: 'text-contrast',
    name: 'Text Contrast',
    description: 'Checks if text has sufficient contrast with its background',
    check: async (node: globalThis.SceneNode): Promise<HeuristicResult[]> => {
      const issues = evaluateTextContrast(node);
      return issues.map(issue => ({
        id: `text-contrast-${issue.nodeId}`,
        nodeId: issue.nodeId,
        nodeName: issue.nodeName,
        type: 'text-contrast',
        category: 'Color Contrast',
        title: 'Text Contrast Issue',
        description: `Text has contrast ratio of ${issue.contrastRatio?.toFixed(2)}:1 with its background (required ≥${issue.requiredRatio}:1)`,
        severity: 'medium',
        recommendations: []
      }));
    }
  },
  {
    id: 'icon-contrast',
    name: 'Icon Contrast',
    description: 'Checks if icons have sufficient contrast with their background',
    check: async (node: globalThis.SceneNode): Promise<HeuristicResult[]> => {
      const issues = evaluateIconContrast(node);
      return issues.map(issue => ({
        id: `icon-contrast-${issue.nodeId}`,
        nodeId: issue.nodeId,
        nodeName: issue.nodeName,
        type: 'icon-contrast',
        category: 'Color Contrast',
        title: 'Icon Contrast Issue',
        description: `Icon has contrast ratio of ${issue.contrastRatio?.toFixed(2)}:1 with its background (required ≥${issue.requiredRatio}:1)`,
        severity: 'medium',
        recommendations: []
      }));
    }
  },
  {
    id: 'button-contrast',
    name: 'Button Contrast',
    description: 'Checks if buttons have sufficient contrast with their background',
    check: async (node: globalThis.SceneNode): Promise<HeuristicResult[]> => {
      const issues = await evaluateButtonContrast(node);
      return issues.map(issue => ({
        id: `button-contrast-${issue.nodeId}`,
        nodeId: issue.nodeId,
        nodeName: issue.nodeName,
        type: 'button-contrast',
        category: 'Color Contrast',
        title: 'Button Contrast Issue',
        description: issue.outlineContrast 
          ? `Button outline has contrast ratio of ${issue.outlineContrast.strokeContrastRatio.toFixed(2)}:1 with its container (required ≥${BUTTON_CONTRAST_REQUIREMENTS.outline.stroke.minimum}:1)`
          : issue.containerContrast 
            ? `Button has contrast ratio of ${issue.containerContrast.boundaryContrastRatio.toFixed(2)}:1 with its container (required ≥${BUTTON_CONTRAST_REQUIREMENTS.boundary.minimum}:1)`
            : 'Button contrast could not be determined',
        severity: 'medium',
        recommendations: []
      }));
    }
  },
  {
    id: 'state-contrast',
    name: 'State Contrast',
    description: 'Checks if interactive elements have sufficient contrast between different states (hover, focus, pressed, disabled)',
    check: async (node: globalThis.SceneNode): Promise<HeuristicResult[]> => {
      const results = await evaluateStateContrast(node);
      return results.map((result: StateContrastResult) => ({
        id: `state-contrast-${result.nodeId}`,
        nodeId: result.nodeId,
        nodeName: result.nodeName,
        type: 'state-contrast',
        category: 'Interactive States',
        title: 'State Contrast Issue',
        description: `${result.nodeName} has state contrast issues`,
        severity: result.issues.some((i: StateContrastIssue) => i.severity === 'high') ? 'high' : 
                 result.issues.some((i: StateContrastIssue) => i.severity === 'medium') ? 'medium' : 'low',
        recommendations: result.issues.map((issue: StateContrastIssue) => issue.recommendation)
      }));
    }
  }
];