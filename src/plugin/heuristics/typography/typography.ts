/**
 * Core typography validation functionality
 */

import { 
  TypographyConfig, 
  TextContext, 
  ValidationResult, 
  TypographyIssue,
  StyleOverride,
  RichTextAnalysis
} from './types';
import { DesignSystemDetector, DesignSystemInfo } from './design-system';
import { 
  TextNodeWithStyle, 
  isMixed, 
  normalizeLineHeight, 
  normalizeLetterSpacing,
  StyledTextSegmentFields
} from './shared';
import { TextRoleAnalyzer } from './analysis';
import { defaultTypographyConfig } from './config';

export class TypographyValidator {
  private config: TypographyConfig;
  private roleAnalyzer: TextRoleAnalyzer;
  private fontCache: Set<string> = new Set();
  private designSystemDetector: DesignSystemDetector | null = null;
  private designSystem: DesignSystemInfo | null = null;
  private designSystemLastChecked: number = 0;
  private readonly DESIGN_SYSTEM_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(config: TypographyConfig = defaultTypographyConfig) {
    this.config = config;
    this.roleAnalyzer = new TextRoleAnalyzer();
  }

  /**
   * Check for design system updates
   */
  private async updateDesignSystem(document: DocumentNode): Promise<void> {
    const now = Date.now();
    if (
      !this.designSystemDetector ||
      now - this.designSystemLastChecked > this.DESIGN_SYSTEM_CHECK_INTERVAL
    ) {
      this.designSystemDetector = new DesignSystemDetector(document);
      this.designSystem = await this.designSystemDetector.detect();
      this.designSystemLastChecked = now;
    }
  }

  /**
   * Validate a batch of text nodes efficiently
   */
  async validateBatch(nodes: TextNode[]): Promise<ValidationResult[]> {
    // Update design system detection
    if (nodes.length > 0) {
      await this.updateDesignSystem(nodes[0].parent?.parent as DocumentNode);
    }

    // Group nodes by font family to minimize font loading
    const fontGroups = this.groupByFont(nodes);
    
    // Process each font group
    const results = await Promise.all(
      Array.from(fontGroups.entries()).map(async ([font, groupNodes]) => {
        if (!this.fontCache.has(font)) {
          try {
            await figma.loadFontAsync({ family: font, style: 'Regular' });
            this.fontCache.add(font);
          } catch (error) {
            console.error(`Failed to load font: ${font}`, error);
          }
        }
        return Promise.all(groupNodes.map(node => this.validate(node as TextNodeWithStyle)));
      })
    );

    return results.flat();
  }

  /**
   * Validate a single text node
   */
  private log(message: string, data?: any) {
    console.log(`[Typography Validator] ${message}`, data || '');
  }

  async validate(node: TextNodeWithStyle): Promise<ValidationResult> {
    this.log(`Starting validation for text node: '${node.characters.substring(0, 20)}${node.characters.length > 20 ? '...' : ''}'`);

    const issues: TypographyIssue[] = [];
    this.log('Analyzing text role...');
    const context = await this.roleAnalyzer.analyzeRole(node);
    this.log('Text role analysis result:', { role: context.role, confidence: context.confidence });
    
    // Get style requirements based on context
    this.log('Getting style requirements for context...');
    const styleRequirements = this.getStyleRequirements(context);
    this.log('Style requirements:', styleRequirements);
    
    // Analyze rich text if mixed styles are present
    this.log('Analyzing rich text...');
    const richTextAnalysis = await this.analyzeRichText(node);
    this.log('Rich text analysis result:', {
      hasMultipleFonts: richTextAnalysis.hasMultipleFonts,
      hasMultipleSizes: richTextAnalysis.hasMultipleSizes,
      segments: richTextAnalysis.segments.length
    });
    
    // Validate font family
    this.validateFontFamily(node, styleRequirements, issues);
    
    // Validate font size
    this.validateFontSize(node, styleRequirements, issues);
    
    // Validate line height
    this.validateLineHeight(node, styleRequirements, issues);
    
    // Validate letter spacing
    this.validateLetterSpacing(node, styleRequirements, issues);
    
    // Check for mixed styles
    if (richTextAnalysis.hasMultipleFonts || richTextAnalysis.hasMultipleSizes) {
      this.validateStyleConsistency(richTextAnalysis, context, issues, node);
    }

    return {
      issues,
      context,
      confidence: context.confidence,
      suggestions: this.generateSuggestions(issues, context),
      node,
      styleOverrides: richTextAnalysis.styleOverrides
    };
  }

  /**
   * Group nodes by font family for efficient font loading
   */
  private groupByFont(nodes: TextNode[]): Map<string, TextNode[]> {
    const groups = new Map<string, TextNode[]>();
    
    nodes.forEach(node => {
      if (!isMixed(node.fontName)) {
        const font = node.fontName.family;
        const group = groups.get(font) || [];
        group.push(node);
        groups.set(font, group);
      } else {
        // Handle mixed fonts by getting all unique fonts
        const fonts = new Set<string>();
        node.getStyledTextSegments(['fontName']).forEach(segment => {
          if (!isMixed(segment.fontName)) {
            fonts.add(segment.fontName.family);
          }
        });
        fonts.forEach(font => {
          const group = groups.get(font) || [];
          group.push(node);
          groups.set(font, group);
        });
      }
    });
    
    return groups;
  }

  /**
   * Get style requirements based on text context
   */
  /**
   * Get validation rules from design system
   */
  private getDesignSystemRules(node: TextNodeWithStyle, context: TextContext): any {
    if (!this.designSystem) return null;

    const tokens = this.designSystem.tokens;
    const role = context.role;
    const frameWidth = ('width' in (node.parent || {})) ? (node.parent as FrameNode).width : 0;

    // Find matching token for the role
    const token = Object.values(tokens.typography).find(t => t.role === role);
    if (!token) return null;

    // Find appropriate breakpoint
    const breakpoint = Object.entries(tokens.breakpoints)
      .find(([_, range]) => {
        return (!range.min || frameWidth >= range.min) && 
               (!range.max || frameWidth <= range.max);
      })?.[0];

    return token.breakpoints[breakpoint || 'default'];
  }

  private getStyleRequirements(context: TextContext) {
    // Try to get rules from design system first
    const designSystemRules = context && this.designSystem ? this.getDesignSystemRules(context.node as TextNodeWithStyle, context) : null;
    if (designSystemRules) {
      return {
        ...designSystemRules,
        source: 'design-system'
      };
    }

    // Fall back to config rules
    const contextRule = this.config.contextRules[context.role];
    if (!contextRule) return null;

    const preferredStyle = this.config.styles[contextRule.preferredStyle];
    if (!preferredStyle) return null;

    return {
      ...preferredStyle,
      allowedStyles: contextRule.allowedStyles.map(style => this.config.styles[style]),
      source: 'config'
    };
  }

  /**
   * Analyze rich text for mixed styles
   */
  private async analyzeRichText(node: TextNodeWithStyle): Promise<RichTextAnalysis> {
    const segments = node.getStyledTextSegments([
      'fontName',
      'fontSize',
      'lineHeight',
      'letterSpacing'
    ]);

    const analysis: RichTextAnalysis = {
      segments: segments.map(segment => ({
        text: segment.characters,
        style: {
          fontFamily: isMixed(segment.fontName) ? 'mixed' : segment.fontName.family,
          fontSize: isMixed(segment.fontSize) ? 0 : segment.fontSize,
          fontWeight: isMixed(segment.fontName) ? 'mixed' : segment.fontName.style,
          lineHeight: isMixed(segment.lineHeight) ? undefined : normalizeLineHeight(segment.lineHeight, isMixed(segment.fontSize) ? undefined : segment.fontSize).value,
          letterSpacing: isMixed(segment.letterSpacing) ? undefined : normalizeLetterSpacing(segment.letterSpacing)
        },
        start: segment.start,
        end: segment.end
      })),
      hasMultipleFonts: false,
      hasMultipleSizes: false,
      hasMultipleWeights: false,
      styleOverrides: []
    };

    // Check for multiple styles
    const fonts = new Set<string>();
    const sizes = new Set<number>();
    const weights = new Set<string>();

    analysis.segments.forEach(segment => {
      if (segment.style.fontFamily !== 'mixed') fonts.add(segment.style.fontFamily);
      if (segment.style.fontSize > 0) sizes.add(segment.style.fontSize);
      if (segment.style.fontWeight !== 'mixed') weights.add(segment.style.fontWeight);
    });

    analysis.hasMultipleFonts = fonts.size > 1;
    analysis.hasMultipleSizes = sizes.size > 1;
    analysis.hasMultipleWeights = weights.size > 1;

    return analysis;
  }

  /**
   * Validate font family
   */
  private validateFontFamily(
    node: TextNodeWithStyle, 
    requirements: any, 
    issues: TypographyIssue[]
  ) {
    this.log('Validating font family...');
    if (isMixed(node.fontName)) return; // Skip mixed fonts, handled by rich text analysis

    const fontFamily = node.fontName.family;
    if (!this.config.fontFamilies.allowed.includes(fontFamily)) {
      issues.push({
        type: 'Invalid Font',
        message: `Font "${fontFamily}" is not in the approved list`,
        severity: 'error',
        code: 'TYPOGRAPHY_INVALID_FONT',
        node,
        expected: this.config.fontFamilies.primary.join(', '),
        actual: fontFamily,
        suggestion: `Use one of the approved fonts: ${this.config.fontFamilies.primary.join(', ')}`
      });
    }
  }

  /**
   * Validate font size
   */
  private getBreakpointKey(width: number): string {
    this.log('Determining breakpoint for width:', width);
    const breakpoints = this.config.breakpoints;
    
    // Sort breakpoints by min value (if exists) or max value
    const sortedBreakpoints = Object.entries(breakpoints).sort((a, b) => {
      const aMin = a[1].min || 0;
      const bMin = b[1].min || 0;
      return aMin - bMin;
    });

    // Find the matching breakpoint
    for (const [key, range] of sortedBreakpoints) {
      if (range.max && width <= range.max) {
        return key;
      }
      if (!range.max && range.min && width >= range.min) {
        return key;
      }
    }

    // Default to the largest breakpoint if no match
    const defaultBreakpoint = sortedBreakpoints[sortedBreakpoints.length - 1][0];
    this.log('Using default/largest breakpoint:', defaultBreakpoint);
    return defaultBreakpoint;
  }

  private getFrameWidth(node: BaseNode): number {
    let current: BaseNode | null = node;
    let topmostFrame: BaseNode | null = null;

    // Traverse up to find the topmost frame
    while (current && 'parent' in current) {
      if ('type' in current && current.type === 'FRAME' && 'width' in current) {
        topmostFrame = current;
      }
      current = current.parent;
    }

    if (topmostFrame && 'width' in topmostFrame) {
      this.log('Frame width:', topmostFrame.width);
      return topmostFrame.width;
    }

    const defaultWidth = 1024;
    this.log('No frame found, using default width:', defaultWidth);
    return defaultWidth;
  }

  private validateFontSize(
    node: TextNodeWithStyle, 
    requirements: any, 
    issues: TypographyIssue[]
  ) {
    if (!requirements) return;

    const isFromDesignSystem = requirements.source === 'design-system';
    const severity = isFromDesignSystem ? 'error' : 'warning';  // Stricter for design system
    this.log('Validating font size...');
    if (isMixed(node.fontSize)) {
      this.log('Skipping font size validation - mixed font sizes detected');
      return;
    } // Skip mixed sizes, handled by rich text analysis

    const fontSize = node.fontSize;
    this.log('Current font size:', fontSize);
    
    const frameWidth = this.getFrameWidth(node);
    this.log('Frame width:', frameWidth);
    
    const breakpointKey = this.getBreakpointKey(frameWidth);
    this.log('Selected breakpoint:', breakpointKey);
    
    const fontSizeRange = requirements.fontSize[breakpointKey];
    if (!fontSizeRange) {
      this.log('No font size range found for breakpoint:', breakpointKey);
      return;
    }
    this.log('Font size range for current breakpoint:', fontSizeRange);

    if (fontSize < fontSizeRange.min || fontSize > fontSizeRange.max) {
      this.log('Font size validation failed:', {
        current: fontSize,
        min: fontSizeRange.min,
        max: fontSizeRange.max
      });
      issues.push({
        type: 'Invalid Font Size',
        message: `Font size ${fontSize}px is outside the recommended range of ${fontSizeRange.min}px to ${fontSizeRange.max}px for this breakpoint (${breakpointKey}, width: ${frameWidth}px)${isFromDesignSystem ? ' (Design System)' : ''}`,
        severity,
        code: 'TYPOGRAPHY_INVALID_SIZE',
        node,
        expected: `${fontSizeRange.min}px - ${fontSizeRange.max}px`,
        actual: fontSize,
        suggestion: `Adjust font size to be between ${fontSizeRange.min}px and ${fontSizeRange.max}px for ${breakpointKey} breakpoint`
      });
    }
  }


  /**
   * Round a number to the nearest even number
   */
  private roundToEven(num: number): number {
    const rounded = Math.round(num);
    return rounded % 2 === 0 ? rounded : rounded + 1;
  }

  /**
   * Validate line height
   */
  private validateLineHeight(
    node: TextNodeWithStyle, 
    requirements: any, 
    issues: TypographyIssue[]
  ) {
    if (!requirements) return;

    const isFromDesignSystem = requirements.source === 'design-system';
    const severity = isFromDesignSystem ? 'error' : 'warning';  // Stricter for design system
    this.log('Validating line height...');
    if (isMixed(node.lineHeight) || isMixed(node.fontSize)) return; // Skip mixed values

    const fontSize = node.fontSize;
    const normalizedLineHeight = normalizeLineHeight(node.lineHeight, fontSize, this.config.autoLineHeight);
    
    // Convert ratio requirements to pixels if we have pixel values
    let minHeight: number, maxHeight: number, actualHeight: number;
    const isAuto = node.lineHeight.unit === 'AUTO';
    
    if (normalizedLineHeight.unit === 'PIXELS') {
      // We have pixel values, convert requirements to pixels and round to even numbers
      minHeight = this.roundToEven(requirements.lineHeight.min * fontSize);
      maxHeight = this.roundToEven(requirements.lineHeight.max * fontSize);
      actualHeight = normalizedLineHeight.value;
    } else {
      // We have ratio values
      minHeight = requirements.lineHeight.min;
      maxHeight = requirements.lineHeight.max;
      actualHeight = normalizedLineHeight.value;
    }

    if (requirements && (actualHeight < minHeight || actualHeight > maxHeight)) {
      const unit = normalizedLineHeight.unit === 'PIXELS' ? 'px' : '';
      const autoMessage = isAuto ? ' (Auto)' : '';
      issues.push({
        type: 'Invalid Line Height',
        message: `Line height ${actualHeight}${unit}${autoMessage} is outside recommended range${isFromDesignSystem ? ' (Design System)' : ''}`,
        severity: isAuto ? 'info' : severity,
        code: 'TYPOGRAPHY_INVALID_LINE_HEIGHT',
        node,
        expected: `${minHeight}${unit}-${maxHeight}${unit}`,
        actual: actualHeight,
        suggestion: isAuto ? 
          `Consider setting an explicit line height between ${minHeight}${unit} and ${maxHeight}${unit} instead of using Auto` :
          `Adjust line height to be between ${minHeight}${unit} and ${maxHeight}${unit}`
      });
    }
  }

  /**
   * Validate letter spacing
   */
  private validateLetterSpacing(
    node: TextNodeWithStyle, 
    requirements: any, 
    issues: TypographyIssue[]
  ) {
    this.log('Validating letter spacing...');
    if (isMixed(node.letterSpacing)) return; // Skip mixed letter spacing

    const letterSpacing = normalizeLetterSpacing(node.letterSpacing);
    if (requirements && (
      letterSpacing < requirements.letterSpacing.min || 
      letterSpacing > requirements.letterSpacing.max
    )) {
      issues.push({
        type: 'Invalid Letter Spacing',
        message: `Letter spacing ${letterSpacing} is outside recommended range`,
        severity: 'warning',
        code: 'TYPOGRAPHY_INVALID_LETTER_SPACING',
        node,
        expected: `${requirements.letterSpacing.min}-${requirements.letterSpacing.max}`,
        actual: letterSpacing,
        suggestion: `Adjust letter spacing to be between ${requirements.letterSpacing.min} and ${requirements.letterSpacing.max}`
      });
    }
  }

  /**
   * Validate style consistency
   */
  private validateStyleConsistency(
    analysis: RichTextAnalysis,
    context: TextContext,
    issues: TypographyIssue[],
    node: TextNodeWithStyle
  ) {
    this.log('Validating style consistency...');
    if (analysis.hasMultipleFonts) {
      issues.push({
        type: 'Mixed Styles',
        message: 'Multiple font families used in single text block',
        severity: 'warning',
        code: 'TYPOGRAPHY_MIXED_FONTS',
        node: node,
        suggestion: 'Use consistent font family within text blocks'
      });
    }

    if (analysis.hasMultipleSizes && !context.role.startsWith('heading')) {
      issues.push({
        type: 'Mixed Styles',
        message: 'Multiple font sizes used in single text block',
        severity: 'warning',
        code: 'TYPOGRAPHY_MIXED_SIZES',
        node: node,
        suggestion: 'Use consistent font size within text blocks'
      });
    }
  }

  /**
   * Generate suggestions based on issues
   */
  private generateSuggestions(issues: TypographyIssue[], context: TextContext): string[] {
    const suggestions = new Set<string>();
    
    issues.forEach(issue => {
      if (issue.suggestion) {
        suggestions.add(issue.suggestion);
      }
    });

    return Array.from(suggestions);
  }
}
