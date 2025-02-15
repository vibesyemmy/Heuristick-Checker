/**
 * Text role analysis functionality
 */

import { TextRole, HeadingRole, TextContext, TextRoleConfig, RichTextAnalysis, StyleOverride } from './types';
import { ContextAnalyzer, ContainerContext } from './context';
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
  private contextAnalyzer: ContextAnalyzer;

  constructor(config: TextRoleConfig = defaultTextRoleConfig) {
    this.config = config;
    this.contextAnalyzer = new ContextAnalyzer();
  }

  /**
   * Main analysis function that combines all signals to determine text role
   */
  async analyzeRole(node: TextNodeWithStyle): Promise<TextContext> {
    const signals = await this.gatherContextSignals(node);
    return this.determineRole(signals, node);
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
    
    // Get enhanced container context
    const containerContext = await this.contextAnalyzer.analyzeContainer(node);
    
    // Top-level position signals
    if (containerContext.relativePosition.verticalPosition === 'top' && 
        containerContext.isFirstChild) {
      const role = this.determineHeadingRole(node);
      signals.push({
        role,
        confidence: 0.7,  // Increased confidence due to better context
        source: 'position',
        reason: `Text appears at the top of ${containerContext.containerType}`
      });
    }

    // Header/Footer specific signals
    if (containerContext.containerType === 'header') {
      signals.push({
        role: 'heading1',
        confidence: 0.8,
        source: 'position',
        reason: 'Text appears in page header'
      });
    }

    // Sidebar specific signals
    if (containerContext.containerType === 'sidebar') {
      signals.push({
        role: 'navigation',
        confidence: 0.6,
        source: 'position',
        reason: 'Text appears in sidebar'
      });
    }

    // Label detection based on context
    if (containerContext.containerType === 'section' && 
        containerContext.relativePosition.verticalPosition === 'top') {
      const nearbyInputs = this.checkForNearbyInputs(node);
      if (nearbyInputs) {
        signals.push({
          role: 'label',
          confidence: 0.7,
          source: 'position',
          reason: 'Text appears above input field'
        });
      }
    }

    return signals;
  }

  private checkForNearbyInputs(node: TextNodeWithStyle): boolean {
    const parent = node.parent;
    if (!parent || !('children' in parent)) return false;

    const siblings = parent.children;
    const nodeIndex = siblings.indexOf(node);
    
    return siblings.some((sibling, index) => {
      if (Math.abs(index - nodeIndex) <= 1) {  // Check adjacent nodes
        return sibling.type === 'RECTANGLE' || 
               sibling.name.toLowerCase().includes('input') ||
               sibling.name.toLowerCase().includes('field');
      }
      return false;
    });
  }

  /**
   * Analyze content-based signals
   */
  private analyzeContent(node: TextNodeWithStyle): ContextSignal[] {
    const signals: ContextSignal[] = [];
    const text = node.characters.trim();

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
    if (signals.length === 0) {
      return {
        role: 'body',  // Default role
        confidence: 0.3,
        hasAmbiguity: false,
        node
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
    const headingMatch = primaryRole.match(/^heading([123])$/);
    if (headingMatch) {
      level = parseInt(headingMatch[1]);
    }

    return {
      role: primaryRole,
      level,
      confidence: Math.min(maxConfidence / signals.length, 1),
      alternativeRoles: alternativeRoles.length > 0 ? alternativeRoles : undefined,
      hasAmbiguity: alternativeRoles.length > 0,
      parentComponent: node.parent?.name,
      node
    };
  }

  /**
   * Determine heading level based on font size and hierarchy
   */
  private determineHeadingRole(node: TextNodeWithStyle): HeadingRole {
    if (isMixed(node.fontSize)) return 'heading2';  // Default to h2 if mixed
    
    const fontSize = node.fontSize;
    if (fontSize >= 32) return 'heading1';
    if (fontSize >= 24) return 'heading2';
    return 'heading3';
  }
}
