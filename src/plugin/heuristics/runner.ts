import { HeuristicResult } from './types';
import { heuristicChecks } from './registry';

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
