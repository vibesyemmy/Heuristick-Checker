figma.showUI(__html__, { width: 320, height: 480 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'analyze-selection') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.notify('Please select elements to analyze');
      return;
    }
    
    // TODO: Implement heuristic analysis
  }
};
