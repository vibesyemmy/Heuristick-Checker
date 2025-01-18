import { HeuristicResult } from './types';
import { generateUUID } from '../utils/uuid';

type NodeContext = 'form' | 'button' | 'container' | 'icon' | 'text' | null;

// Common loading/progress indicator patterns
const LOADING_PATTERNS = {
  SPINNERS: ['spinner', 'loader', 'loading-indicator', 'loading-component'],
  PROGRESS_BARS: ['progress-bar', 'progress-track', 'progress-indicator'],
  SKELETON: ['skeleton-loader', 'content-placeholder', 'loading-skeleton'],
  FEEDBACK: ['toast', 'notification', 'alert', 'message', 'snackbar']
} as const;

// UI patterns that typically need loading states
const LOADING_TRIGGERS = {
  BUTTONS: ['submit', 'save', 'upload', 'create', 'update', 'delete'],
  FORMS: ['form', 'signup', 'login', 'register', 'contact'],
  DATA_VIEWS: ['table', 'list', 'grid', 'feed', 'dashboard']
} as const;

interface LoaderValidationIssue {
  type: 'loader-validation';
  elementName: string;
  nodeId: string;
  message: string;
  recommendations: string[];
}

interface MissingLoaderIssue {
  type: 'missing-loader';
  elementName: string;
  nodeId: string;
  triggerType: keyof typeof LOADING_TRIGGERS;
  message: string;
  recommendations: string[];
}

type ProgressFeedbackIssue = LoaderValidationIssue | MissingLoaderIssue;

// Helper function to get node context
async function getNodeContext(node: SceneNode): Promise<NodeContext> {
  if (!('name' in node)) return null;
  
  const nodeName = node.name.toLowerCase();
  
  // Check if it's an icon
  if (nodeName.includes('icon') || 
      (node.type === 'INSTANCE' && 
       (await node.getMainComponentAsync())?.name.toLowerCase().includes('icon'))) {
    return 'icon';
  }
  
  // Check if it's just text
  if ('characters' in node) {
    return 'text';
  }
  
  // Check for buttons
  if (node.type === 'INSTANCE' && 
      (nodeName.includes('button') || 
       (await node.getMainComponentAsync())?.name.toLowerCase().includes('button'))) {
    return 'button';
  }
  
  // Check for forms (should be a container with inputs)
  if ('children' in node && 
      node.children.some(child => 
        child.type === 'INSTANCE' && 
        child.name.toLowerCase().includes('input'))) {
    return 'form';
  }
  
  // Check for general containers
  if ('children' in node && !('characters' in node)) {
    return 'container';
  }
  
  return null;
}

// Helper function to detect loading indicators
async function detectLoadingIndicators(node: SceneNode): Promise<boolean> {
  if (!('name' in node)) return false;
  
  const nodeName = node.name.toLowerCase();
  const context = await getNodeContext(node);
  
  // Skip text nodes unless they're part of a loading component
  if (context === 'text' && !nodeName.includes('loading component')) {
    return false;
  }
  
  // Skip icons unless they're specifically loading icons
  if (context === 'icon' && !nodeName.includes('loading')) {
    return false;
  }
  
  // Check for actual loading patterns
  return Object.values(LOADING_PATTERNS).some(patterns =>
    patterns.some(pattern => {
      // More precise pattern matching
      const exactMatch = nodeName === pattern;
      const componentMatch = nodeName.includes(`${pattern}-component`);
      const stateMatch = nodeName.includes(`${pattern}-state`);
      
      return exactMatch || componentMatch || stateMatch;
    })
  );
}

// Helper function to detect feedback elements
async function detectFeedbackElements(node: SceneNode): Promise<boolean> {
  if (!('name' in node)) return false;
  
  const nodeName = node.name.toLowerCase();
  const context = await getNodeContext(node);
  
  // Only consider actual feedback components
  return context !== 'icon' && context !== 'text' &&
         LOADING_PATTERNS.FEEDBACK.some(pattern => 
           nodeName === pattern || 
           nodeName.includes(`${pattern}-component`));
}

// Helper function to check if node needs a loader
async function inferLoaderNeed(node: SceneNode): Promise<{ needs: boolean; triggerType: keyof typeof LOADING_TRIGGERS | null }> {
  const context = await getNodeContext(node);
  if (!context || !('name' in node)) return { needs: false, triggerType: null };
  
  const nodeName = node.name.toLowerCase();
  
  switch (context) {
    case 'button':
      // Only suggest loaders for action buttons
      if (LOADING_TRIGGERS.BUTTONS.some(trigger => nodeName.includes(trigger))) {
        return { needs: true, triggerType: 'BUTTONS' };
      }
      break;
      
    case 'form':
      // Only for the form container, not individual inputs
      if (LOADING_TRIGGERS.FORMS.some(trigger => nodeName.includes(trigger))) {
        return { needs: true, triggerType: 'FORMS' };
      }
      break;
      
    case 'container':
      // Only for data containers
      if (LOADING_TRIGGERS.DATA_VIEWS.some(trigger => nodeName.includes(trigger))) {
        return { needs: true, triggerType: 'DATA_VIEWS' };
      }
      break;
  }
  
  return { needs: false, triggerType: null };
}

// Helper function to validate loader implementation
async function validateLoader(node: SceneNode): Promise<LoaderValidationIssue | null> {
  const issues: string[] = [];
  const context = await getNodeContext(node);
  
  // Only validate actual loaders
  if (context === 'icon' || context === 'text') return null;
  
  // Check size (if applicable)
  if ('width' in node && 'height' in node) {
    const minSize = 16;
    if (node.width < minSize || node.height < minSize) {
      issues.push(`Loader size (${node.width}x${node.height}) is too small. Aim for at least ${minSize}x${minSize} pixels.`);
    }
  }
  
  // Check if loader has states/variants
  if (node.type === 'INSTANCE') {
    const mainComponent = await node.getMainComponentAsync();
    if (mainComponent?.parent?.type !== 'COMPONENT_SET') {
      issues.push('Loader lacks state variations. Consider adding different states (e.g., determinate/indeterminate).');
    }
  }
  
  // Check if loader has associated feedback
  if (!(await detectFeedbackElements(node))) {
    issues.push('No feedback elements found near the loader. Consider adding status messages or tooltips.');
  }
  
  if (issues.length > 0) {
    return {
      type: 'loader-validation',
      elementName: node.name,
      nodeId: node.id,
      message: `Loader "${node.name}" has implementation issues`,
      recommendations: issues
    };
  }
  
  return null;
}

// Helper function to generate loader recommendations
function getLoaderRecommendations(triggerType: keyof typeof LOADING_TRIGGERS): string[] {
  const baseRecs = [
    'Add a loading indicator to show processing state',
    'Include feedback messages to communicate progress'
  ];
  
  const specificRecs: Record<keyof typeof LOADING_TRIGGERS, string[]> = {
    BUTTONS: [
      'Add a spinner inside the button during processing',
      'Disable the button while loading to prevent double-clicks'
    ],
    FORMS: [
      'Show a loading overlay during form submission',
      'Add progress steps for multi-step forms'
    ],
    DATA_VIEWS: [
      'Use skeleton screens while loading data',
      'Show loading state in empty table/list rows'
    ]
  };
  
  return [...baseRecs, ...specificRecs[triggerType]];
}

// Main analysis function
export async function analyzeProgressFeedback(node: SceneNode): Promise<HeuristicResult[]> {
  const results: HeuristicResult[] = [];
  const issues: ProgressFeedbackIssue[] = [];

  // Helper function to recursively check nodes
  async function checkNode(node: SceneNode) {
    // Skip if node is hidden
    if ('visible' in node && !node.visible) return;

    // Step 1: Validate existing loaders
    if (await detectLoadingIndicators(node)) {
      const validationIssue = await validateLoader(node);
      if (validationIssue) issues.push(validationIssue);
    }
    // Step 2: Check if loader is needed but missing
    else {
      const { needs, triggerType } = await inferLoaderNeed(node);
      if (needs && triggerType) {
        issues.push({
          type: 'missing-loader',
          elementName: node.name,
          nodeId: node.id,
          triggerType,
          message: `${node.name} might need a loading indicator`,
          recommendations: getLoaderRecommendations(triggerType)
        });
      }
    }

    // Recursively check children
    if ('children' in node) {
      for (const child of node.children) {
        await checkNode(child);
      }
    }
  }

  // Start recursive check
  await checkNode(node);

  // Convert issues to results
  for (const issue of issues) {
    results.push({
      id: generateUUID(),
      type: 'progress-feedback',
      category: 'System Feedback',
      title: issue.type === 'loader-validation' ? 'Loader Implementation Issues' : 'Missing Loading Indicator',
      description: issue.message,
      severity: issue.type === 'loader-validation' ? 'medium' : 'low',
      recommendations: issue.recommendations,
      nodeId: issue.nodeId,
      nodeName: issue.elementName
    });
  }

  return results;
}
