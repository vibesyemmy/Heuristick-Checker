console.log('Plugin code starting');

import { runHeuristicChecks } from './heuristics/runner';
import { HeuristicResult } from './heuristics/types';

figma.showUI(__html__, {
  width: 400,
  height: 750
});

console.log('UI shown');

// Listen for selection changes
figma.on('selectionchange', () => {
  const selection = figma.currentPage.selection;
  
  // Send the first selected element to the UI
  figma.ui.postMessage({
    type: 'selection-change',
    elements: selection.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type
    }))
  });
});

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'scan-element') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Please select an element to analyze'
      });
      return;
    }

    const node = selection[0];
    
    try {
      console.log('Starting heuristic checks...');
      const results = await runHeuristicChecks(node);
      console.log('Heuristic checks completed:', results);
      
      if (results.length === 0) {
        figma.ui.postMessage({
          type: 'analysis-complete',
          results: [],
          message: ' Fantastic work! Your design meets all accessibility criteria we checked. Keep up the awesome work! '
        });
        return;
      }
      
      // Send results back to UI
      figma.ui.postMessage({
        type: 'analysis-complete',
        results: results
      });
    } catch (error) {
      console.error('Error during analysis:', error);
      figma.ui.postMessage({
        type: 'error',
        message: 'Error during analysis: ' + (error as Error).message
      });
    }
  }

  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
  }
};

// Send a test message to UI
setTimeout(() => {
  console.log('Sending test message to UI');
  figma.ui.postMessage({ type: 'test' });
}, 2000);
