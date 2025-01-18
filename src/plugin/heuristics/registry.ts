import { HeuristicDefinition, HeuristicResult } from './types';
import { analyzeStateContrast } from './stateContrast';
import { analyzeProgressFeedback } from './progressFeedback';

export const heuristicChecks: HeuristicDefinition[] = [
  {
    id: 'progress-feedback',
    name: 'Progress Feedback',
    description: 'Check if interactive elements have proper loading states and progress indicators',
    category: 'System Feedback',
    check: analyzeProgressFeedback
  }
];

// Run all registered heuristic checks on a node
export async function runHeuristicChecks(node: SceneNode): Promise<HeuristicResult[]> {
  const results: HeuristicResult[] = [];
  
  for (const check of heuristicChecks) {
    try {
      const checkResults = await check.check(node);
      if (checkResults) {
        if (Array.isArray(checkResults)) {
          results.push(...checkResults);
        } else {
          results.push(checkResults);
        }
      }
    } catch (error) {
      console.error(`Error running heuristic check: ${error}`);
    }
  }

  return results;
}
