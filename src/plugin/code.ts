console.log('Plugin code starting');

import { evaluateTextContrast } from './heuristics/contrast';

figma.showUI(__html__, {
  width: 450,
  height: 600
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
      // Run contrast analysis
      const contrastIssues = evaluateTextContrast(node);
      
      if (contrastIssues.length === 0) {
        figma.ui.postMessage({
          type: 'analysis-complete',
          results: [],
          message: '🎉 Fantastic work! Your design is looking great from an accessibility standpoint. All text elements have excellent contrast ratios that meet or exceed WCAG standards. Keep up the awesome work! 🌟'
        });
        return;
      }
      
      // Send results back to UI
      figma.ui.postMessage({
        type: 'analysis-complete',
        results: contrastIssues.map(issue => ({
          ...issue,
          category: 'Color Contrast',
          title: 'Insufficient Text Contrast',
          description: `Text contrast ratio is ${issue.contrastRatio?.toFixed(2)}:1 (required ≥${issue.requiredRatio}:1)`,
          severity: (issue.contrastRatio && issue.contrastRatio < issue.requiredRatio! * 0.5) ? 'high' : 'medium'
        }))
      });
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Error analyzing contrast: ' + (error as Error).message
      });
    }
  }
};

// Send a test message to UI
setTimeout(() => {
  console.log('Sending test message to UI');
  figma.ui.postMessage({ type: 'test' });
}, 1000);
