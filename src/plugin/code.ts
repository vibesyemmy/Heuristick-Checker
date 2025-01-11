console.log('Plugin code starting');

import { evaluateTextContrast } from './heuristics/contrast';
import { evaluateIconContrast } from './heuristics/iconContrast';

interface AnalysisIssue {
  type: 'text-contrast' | 'icon-contrast';
  nodeId: string;
  nodeName: string;
  category?: string;
  title?: string;
  description?: string;
  severity?: 'high' | 'medium' | 'low';
  textColor?: string;
  backgroundColor?: string;
  contrastRatio?: number;
  requiredRatio?: number;
  recommendations?: string[];
  role?: 'interactive' | 'informative' | 'decorative';
  colors?: {
    original: string;
    blended: string;
    coverage: number;
    contrastRatio: number;
  }[];
  failingColors?: string[];
  isCompliant?: boolean;
}

figma.showUI(__html__, {
  width: 450,
  height: 550
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
  if (msg.type === 'analyze-selection') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.notify('Please select at least one layer to analyze');
      return;
    }

    const issues: AnalysisIssue[] = [];
    
    // Analyze each selected node
    selection.forEach(node => {
      // Check text contrast
      const textContrastIssues = evaluateTextContrast(node);
      if (textContrastIssues.length > 0) {
        issues.push(...textContrastIssues.map(issue => ({
          type: 'text-contrast' as const,
          ...issue,
          category: 'Color Contrast',
          title: 'Insufficient Text Contrast',
          description: `Text contrast ratio is ${issue.contrastRatio?.toFixed(2)}:1 (required ≥${issue.requiredRatio}:1)`,
          severity: (issue.contrastRatio && issue.contrastRatio < issue.requiredRatio! * 0.5) ? 'high' as const : 'medium' as const
        })));
      }

      // Check icon contrast
      const iconContrastIssues = evaluateIconContrast(node);
      if (iconContrastIssues.length > 0) {
        issues.push(...iconContrastIssues.map(issue => ({
          type: 'icon-contrast' as const,
          nodeId: issue.nodeId,
          nodeName: issue.nodeName,
          category: 'Color Contrast',
          title: 'Insufficient Icon Contrast',
          description: `Icon requires ${issue.requiredRatio}:1 contrast ratio for ${issue.role} use`,
          severity: issue.role === 'interactive' ? 'high' as const : 'medium' as const,
          role: issue.role,
          colors: issue.colors,
          backgroundColor: issue.backgroundColor,
          requiredRatio: issue.requiredRatio,
          isCompliant: issue.isCompliant,
          failingColors: issue.failingColors,
          recommendations: issue.recommendations
        })));
      }
    });

    // Send results back to UI
    figma.ui.postMessage({
      type: 'analysis-results',
      issues
    });
  }

  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
  }

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
          type: 'text-contrast' as const,
          ...issue,
          category: 'Color Contrast',
          title: 'Insufficient Text Contrast',
          description: `Text contrast ratio is ${issue.contrastRatio?.toFixed(2)}:1 (required ≥${issue.requiredRatio}:1)`,
          severity: (issue.contrastRatio && issue.contrastRatio < issue.requiredRatio! * 0.5) ? 'high' as const : 'medium' as const
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
