import { HeuristicResult } from './types';
import { heuristics } from './registry';

export async function runHeuristicChecks(node: SceneNode): Promise<HeuristicResult[]> {
  const results: HeuristicResult[] = [];
  
  for (const heuristic of heuristics) {
    try {
      const heuristicResults = await heuristic.check(node);
      results.push(...heuristicResults);
    } catch (error) {
      console.error(`Error running heuristic ${heuristic.id}:`, error);
    }
  }
  
  return results;
}
