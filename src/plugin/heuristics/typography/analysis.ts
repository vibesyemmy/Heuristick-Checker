/**
 * Text role analysis functionality
 */

import { TextRole, TextContext, TextRoleConfig, RichTextAnalysis, StyleOverride } from './types';
import { TextNodeWithStyle, isMixed, isFontName, normalizeLineHeight, normalizeLetterSpacing, extractRoleFromName } from './shared';
import { defaultTextRoleConfig } from './config';

interface ContextSignal {
  role: TextRole;
  confidence: number;
  source: 'style' | 'position' | 'content' | 'hierarchy';
  reason: string;
}

export class TextRoleAnalyzer {
  private config: TextRoleConfig;

  constructor(config: TextRoleConfig = defaultTextRoleConfig) {
    this.config = config;
  }

  private getFrameWidth(node: TextNodeWithStyle): number {
    let current = node.parent;
    let width = 1024; // Default width

    while (current) {
      if ('width' in current) {
        width = current.width;
        break;
      }
      current = current.parent;
    }

    return width;
  }

  private getBreakpointKey(node: TextNodeWithStyle): BreakpointKey {
    const width = this.getFrameWidth(node);
    if (width <= 600) return 'xs';
    if (width <= 960) return 'sm';
    if (width <= 1280) return 'md';
    if (width <= 1920) return 'lg';
    return 'xl';
  }

  private getSizeCategory(node: TextNodeWithStyle): 'small' | 'medium' | 'large' {
    const width = this.getFrameWidth(node);
    if (width <= 960) return 'small';
    if (width <= 1280) return 'medium';
    return 'large';
  }

  /**
   * Main analysis function that combines all signals to determine text role
   */
  async analyzeRole(node: TextNodeWithStyle): Promise<TextContext> {
    console.log('Debug - analyzeRole start:', {
      nodeName: node.name,
      nodeText: node.characters,
      fontSize: node.fontSize
    });

    const signals = await this.gatherContextSignals(node);
    const role = this.determineRole(signals, node);

    console.log('Debug - analyzeRole result:', {
      signals,
      role
    });

    return role;
  }

  /**
   * Gather all context signals from different sources
   */
  private async gatherContextSignals(node: TextNodeWithStyle): Promise<ContextSignal[]> {
    const signals: ContextSignal[] = [];

    // Analyze each aspect and collect signals
    signals.push(...this.analyzeStyle(node));
    signals.push(...await this.analyzePosition(node));
    signals.push(...this.analyzeContent(node));
    signals.push(...this.analyzeHierarchy(node));

    return signals;
  }

  /**
   * Analyze style-based signals (font size, weight, etc.)
   */
  private analyzeStyle(node: TextNodeWithStyle): ContextSignal[] {
    const signals: ContextSignal[] = [];

    // Skip if mixed styles
    if (isMixed(node.fontSize) || isMixed(node.fontName)) {
      return signals;
    }

    // Check font size signals
    const fontSize = node.fontSize;
    Object.entries(this.config.styleSignals).forEach(([role, config]) => {
      if (config.fontSize) {
        const { min, max } = config.fontSize;
        if (fontSize >= min && fontSize <= max) {
          signals.push({
            role: role as TextRole,
            confidence: 0.3,
            source: 'style',
            reason: `Font size ${fontSize}px matches ${role} range (${min}-${max}px)`
          });
        }
      }
    });

    // Check font weight signals
    if (isFontName(node.fontName)) {
      const fontWeight = node.fontName.style;
      Object.entries(this.config.styleSignals).forEach(([role, config]) => {
        if (config.fontWeight?.includes(fontWeight)) {
          signals.push({
            role: role as TextRole,
            confidence: 0.4,
            source: 'style',
            reason: `Font weight "${fontWeight}" matches ${role} style`
          });
        }
      });
    }

    return signals;
  }

  /**
   * Analyze position-based signals
   */
  private async analyzePosition(node: TextNodeWithStyle): Promise<ContextSignal[]> {
    const signals: ContextSignal[] = [];
    
    // Check if node is at the top of its parent
    const parent = node.parent;
    if (parent && 'children' in parent) {
      const siblings = parent.children;
      const nodeIndex = siblings.indexOf(node);
      
      // Top-level position signal
      if (nodeIndex === 0 || nodeIndex === 1) {
        signals.push({
          role: 'heading',
          confidence: 0.5,
          source: 'position',
          reason: 'Text appears at the top of its container'
        });
      }

      // Check for nearby input fields (label detection)
      const nearbyInputs = siblings.some((sibling, index) => {
        if (Math.abs(index - nodeIndex) <= 1) {  // Check adjacent nodes
          return sibling.type === 'RECTANGLE' || 
                 sibling.name.toLowerCase().includes('input') ||
                 sibling.name.toLowerCase().includes('field');
        }
        return false;
      });

      if (nearbyInputs) {
        signals.push({
          role: 'label',
          confidence: 0.6,
          source: 'position',
          reason: 'Text appears near input field'
        });
      }
    }

    return signals;
  }

  /**
   * Analyze content-based signals
   */
  private analyzeContent(node: TextNodeWithStyle): ContextSignal[] {
    const signals: ContextSignal[] = [];
    const text = node.characters.trim();
    const nodeName = node.name?.trim() || '';

    console.log('Debug - analyzeContent:', {
      text,
      nodeName,
      patterns: Object.fromEntries(
        Object.entries(this.config)
          .filter(([k]) => k.endsWith('Patterns'))
          .map(([k, v]) => [k, v])
      )
    });

    // Check against pattern matchers
    Object.entries(this.config).forEach(([key, patterns]) => {
      if (Array.isArray(patterns) && key.endsWith('Patterns')) {
        const role = key.replace('Patterns', '') as TextRole;
        patterns.forEach(pattern => {
          if (pattern.test(text)) {
            signals.push({
              role,
              confidence: 0.7,
              source: 'content',
              reason: `Text content "${text}" matches ${role} pattern`
            });
          }
        });
      }
    });

    // Additional content analysis
    if (/^[A-Z0-9\s]{1,4}$/i.test(text)) {  // Short text in caps
      signals.push({
        role: 'button',
        confidence: 0.4,
        source: 'content',
        reason: 'Short, capitalized text typical of buttons'
      });
    }

    if (text.length > 200) {  // Long text
      signals.push({
        role: 'body',
        confidence: 0.6,
        source: 'content',
        reason: 'Long text content typical of body copy'
      });
    }

    return signals;
  }

  /**
   * Analyze hierarchy-based signals
   */
  private analyzeHierarchy(node: TextNodeWithStyle): ContextSignal[] {
    const signals: ContextSignal[] = [];
    let current: BaseNode | null = node;

    // Traverse up the hierarchy
    while (current) {
      const role = extractRoleFromName(current.name);
      if (role) {
        signals.push({
          role,
          confidence: 0.8,
          source: 'hierarchy',
          reason: `Parent component "${current.name}" indicates ${role} role`
        });
        break;
      }
      current = current.parent;
    }

    return signals;
  }

  /**
   * Determine final role from collected signals
   */
  private determineRole(signals: ContextSignal[], node: TextNodeWithStyle): TextContext {
    const frameWidth = this.getFrameWidth(node);
    const breakpointKey = this.getBreakpointKey(node);
    const sizeCategory = this.getSizeCategory(node);
    if (signals.length === 0) {
      return {
        role: 'body',  // Default role
        confidence: 0.3,
        hasAmbiguity: false
      };
    }

    // Group signals by role and calculate total confidence
    const roleConfidence = new Map<TextRole, number>();
    signals.forEach(signal => {
      const current = roleConfidence.get(signal.role) || 0;
      roleConfidence.set(signal.role, current + signal.confidence);
    });

    // Find role with highest confidence
    let maxConfidence = 0;
    let primaryRole: TextRole = 'body';
    let alternativeRoles: TextRole[] = [];

    roleConfidence.forEach((confidence, role) => {
      if (confidence > maxConfidence) {
        alternativeRoles = primaryRole !== 'body' ? [primaryRole, ...alternativeRoles] : alternativeRoles;
        maxConfidence = confidence;
        primaryRole = role;
      } else if (confidence > maxConfidence * 0.8) {  // Close alternative
        alternativeRoles.push(role);
      }
    });

    // Determine heading level if applicable
    let level: number | undefined;
    if (primaryRole === 'heading' as TextRole) {
      level = this.determineHeadingLevel(node);
    }

    return {
      role: primaryRole,
      level,
      confidence: Math.min(maxConfidence / signals.length, 1),
      alternativeRoles: alternativeRoles.length > 0 ? alternativeRoles : undefined,
      hasAmbiguity: alternativeRoles.length > 0,
      parentComponent: node.parent?.name
    };
  }

  /**
   * Determine heading level based on font size and hierarchy
   */
  private determineHeadingLevel(node: TextNodeWithStyle): number {
    if (isMixed(node.fontSize)) return 2;  // Default to h2 if mixed
    
    const fontSize = node.fontSize;
    if (fontSize >= 32) return 1;
    if (fontSize >= 24) return 2;
    if (fontSize >= 20) return 3;
    if (fontSize >= 18) return 4;
    if (fontSize >= 16) return 5;
    return 6;
  }
}
