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

// Recursive function to analyze nodes and their children
function analyzeNode(node: SceneNode): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  
  console.log(`Analyzing node: "${node.name}" (type: ${node.type})`);
  
  // Check text contrast
  const textContrastIssues = evaluateTextContrast(node);
  if (textContrastIssues.length > 0) {
    console.log(`Found ${textContrastIssues.length} text contrast issues`);
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
  console.log(`Checking icon contrast for "${node.name}"`);
  const iconContrastResult = evaluateIconContrast(node);
  if (iconContrastResult) {
    console.log(`Icon contrast result for "${node.name}":`, iconContrastResult);
    if (!iconContrastResult.isCompliant) {
      console.log(`Found icon contrast issue for "${node.name}"`);
      issues.push({
        type: 'icon-contrast' as const,
        nodeId: iconContrastResult.nodeId,
        nodeName: iconContrastResult.nodeName,
        category: 'Color Contrast',
        title: 'Insufficient Icon Contrast',
        description: `Icon requires ${iconContrastResult.requiredRatio}:1 contrast ratio for ${iconContrastResult.role} use`,
        severity: iconContrastResult.role === 'interactive' ? 'high' as const : 'medium' as const,
        role: iconContrastResult.role,
        colors: iconContrastResult.colors.map(color => ({
          original: `rgb(${Math.round(color.original.r * 255)}, ${Math.round(color.original.g * 255)}, ${Math.round(color.original.b * 255)})`,
          blended: `rgb(${Math.round(color.blended.r * 255)}, ${Math.round(color.blended.g * 255)}, ${Math.round(color.blended.b * 255)})`,
          coverage: 1, // We don't track coverage for icons
          contrastRatio: color.contrastRatio
        })),
        failingColors: iconContrastResult.failingColors?.map(color => 
          `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`
        ),
        isCompliant: iconContrastResult.isCompliant
      });
    }
  }

  // Recursively check children
  if ('children' in node) {
    console.log(`Checking ${node.children.length} children of "${node.name}"`);
    node.children.forEach(child => {
      issues.push(...analyzeNode(child));
    });
  }

  return issues;
}

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'analyze-selection') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.notify('Please select at least one layer to analyze');
      return;
    }

    try {
      const issues: AnalysisIssue[] = [];
      
      // Analyze each selected node and its children
      selection.forEach(node => {
        issues.push(...analyzeNode(node));
      });

      // Send results back to UI
      figma.ui.postMessage({
        type: 'analysis-results',
        issues
      });
    } catch (error) {
      console.error('Error analyzing contrast:', error);
      figma.ui.postMessage({
        type: 'error',
        message: 'Error analyzing contrast: ' + (error as Error).message
      });
    }
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
