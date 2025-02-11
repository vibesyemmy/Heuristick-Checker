import { ButtonDetectionConfig } from '../config/buttonDetection';

export interface AIDetectionResult {
  confidence: number;
  role: string;
  semanticType: string;
  reasons: string[];
}

/**
 * Uses available information to detect the semantic role of a node
 */
export async function detectNodeRole(node: SceneNode): Promise<AIDetectionResult> {
  try {
    // Check component properties
    if (node.type === 'INSTANCE') {
      const mainComponent = await node.getMainComponentAsync();
      if (mainComponent) {
        // Check if it's a published component
        const isPublished = mainComponent.remote;
        const description = mainComponent.description || '';
        const name = mainComponent.name.toLowerCase();
        
        // Analyze component metadata
        const isButton = 
          name.includes('button') || 
          description.toLowerCase().includes('button') ||
          (isPublished && name.match(/\b(btn|cta)\b/));
        
        if (isButton) {
          const confidence = isPublished ? 0.9 : 0.7;
          return {
            confidence,
            role: 'button',
            semanticType: 'button',
            reasons: [
              'Component analysis:',
              isPublished ? '- Published component' : '- Local component',
              name.includes('button') ? '- Named as button' : '',
              description.includes('button') ? '- Described as button' : ''
            ].filter(r => r)
          };
        }
      }
    }
    
    // Check for auto-layout and constraints
    if ('layoutMode' in node) {
      const hasAutoLayout = node.layoutMode !== 'NONE';
      const hasFixedSize = 
        node.primaryAxisSizingMode === 'FIXED' || 
        node.counterAxisSizingMode === 'FIXED';
      const hasPadding = 
        node.paddingTop > 0 || 
        node.paddingBottom > 0 || 
        node.paddingLeft > 0 || 
        node.paddingRight > 0;
      
      if (hasAutoLayout && hasFixedSize && hasPadding) {
        return {
          confidence: 0.6,
          role: 'button',
          semanticType: 'interactive',
          reasons: [
            'Layout analysis:',
            '- Uses auto-layout',
            '- Has fixed dimensions',
            '- Includes padding'
          ]
        };
      }
    }
    
    // Default case
    return {
      confidence: 0,
      role: '',
      semanticType: '',
      reasons: ['No clear semantic role detected']
    };
  } catch (error) {
    console.error('Error in semantic analysis:', error);
    return {
      confidence: 0,
      role: '',
      semanticType: '',
      reasons: ['Error during semantic analysis']
    };
  }
}
