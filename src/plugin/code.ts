console.log('Plugin code starting');

import { runHeuristicChecks } from './heuristics/runner';
import { HeuristicResult } from './heuristics/types';

figma.showUI(__html__, {
  width: 400,
  height: 750
});

console.log('UI shown');

// Send initial selection state
const currentSelection = figma.currentPage.selection;
const initialElements = currentSelection.map(node => ({
  id: node.id,
  name: node.name,
  type: node.type
}));

figma.ui.postMessage({
  type: 'selection-change',
  elements: initialElements
});

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
          message: 'No issues found'
        });
      } else {
        figma.ui.postMessage({
          type: 'analysis-complete',
          results: results
        });
      }
    } catch (error: unknown) {
      console.error('Error running heuristic checks:', error);
      figma.ui.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  } else if (msg.type === 'select-node') {
    // Handle node selection
    const nodeId = msg.nodeId;
    
    try {
      // Use getNodeByIdAsync instead of getNodeById
      const node = await figma.getNodeByIdAsync(nodeId);
      
      if (node && 'type' in node && node.type !== 'PAGE') {
        const sceneNode = node as SceneNode;
        
        // Clear current selection
        figma.currentPage.selection = [];
        // Select the node
        figma.currentPage.selection = [sceneNode];
        
        // Get the node's absolute position and size
        const bounds = sceneNode.absoluteBoundingBox;
        if (bounds) {
          // Calculate the center point of the node
          const targetX = bounds.x + bounds.width / 2;
          const targetY = bounds.y + bounds.height / 2;
          const targetZoom = 0.8;

          // Get current viewport position and zoom
          const startX = figma.viewport.center.x;
          const startY = figma.viewport.center.y;
          const startZoom = figma.viewport.zoom;

          // Animation duration in milliseconds
          const duration = 300;
          const startTime = Date.now();

          function easeOutCubic(t: number): number {
            return 1 - Math.pow(1 - t, 3);
          }

          function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutCubic(progress);

            // Interpolate position and zoom
            const currentX = startX + (targetX - startX) * eased;
            const currentY = startY + (targetY - startY) * eased;
            const currentZoom = startZoom + (targetZoom - startZoom) * eased;

            // Update viewport
            figma.viewport.center = { x: currentX, y: currentY };
            figma.viewport.zoom = currentZoom;

            // Continue animation if not finished
            if (progress < 1) {
              setTimeout(animate, 1000 / 60); // Aim for 60fps
            }
          }

          // Start animation
          animate();
        } else {
          // Fallback to scrollAndZoomIntoView if bounds are not available
          figma.viewport.scrollAndZoomIntoView([sceneNode]);
        }
      }
    } catch (error) {
      console.error('Error selecting node:', error);
    }
  } else if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
  }
};

// Send a test message to UI
setTimeout(() => {
  console.log('Sending test message to UI');
  figma.ui.postMessage({ type: 'test' });
}, 2000);
