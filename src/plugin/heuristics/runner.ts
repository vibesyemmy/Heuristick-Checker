import { HeuristicResult } from './types';
import { heuristicChecks } from './registry';

export async function runHeuristicChecks(node: SceneNode): Promise<HeuristicResult[]> {
  const allResults: HeuristicResult[] = [];
  
  for (const heuristic of heuristicChecks) {
    try {
      console.log(`Running heuristic check: ${heuristic.name}`);
      const results = await heuristic.check(node);
      allResults.push(...results);
    } catch (error) {
      console.error(`Error in heuristic check ${heuristic.name}:`, error);
    }
  }
  
  return allResults;
}
