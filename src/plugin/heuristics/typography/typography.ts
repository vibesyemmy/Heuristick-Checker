/**
 * Core typography validation functionality
 */

import { 
  TypographyConfig, 
  TextContext, 
  ValidationResult, 
  TypographyIssue,
  StyleOverride,
  RichTextAnalysis,
  BreakpointKey,
  TypeScale,
  ComponentScale
} from './types';
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
  protected roleAnalyzer: TextRoleAnalyzer;
  private fontCache: Set<string> = new Set();

  constructor(config: TypographyConfig = defaultTypographyConfig) {
    this.config = config;
    this.roleAnalyzer = new TextRoleAnalyzer();
  }

  protected async analyzeRichText(node: TextNodeWithStyle): Promise<RichTextAnalysis | undefined> {
    // Return undefined if getStyledTextSegments is not available
    if (!node.getStyledTextSegments) {
      return undefined;
    }

    // Get text segments with all required properties
    const segments = node.getStyledTextSegments([
      'fontName',
      'fontSize',
      'lineHeight',
      'letterSpacing',
      'textCase',
      'textDecoration',
      'textAlignHorizontal'
    ]);

    // Process each segment
    const processedSegments = segments.map(segment => ({
      text: segment.characters,
      start: segment.start,
      end: segment.end,
      style: {
        fontFamily: segment.fontName.family,
        fontSize: segment.fontSize,
        fontWeight: segment.fontName.style,
        lineHeight: segment.lineHeight && typeof segment.lineHeight === 'object' && 'value' in segment.lineHeight ? segment.lineHeight.value : undefined,
        letterSpacing: segment.letterSpacing && typeof segment.letterSpacing === 'object' && 'value' in segment.letterSpacing ? segment.letterSpacing.value : undefined
      }
    }));

    // Check for style variations
    const hasMultipleFonts = new Set(processedSegments.map(s => s.style.fontFamily)).size > 1;
    const hasMultipleSizes = new Set(processedSegments.map(s => s.style.fontSize)).size > 1;
    const hasMultipleWeights = new Set(processedSegments.map(s => s.style.fontWeight)).size > 1;

    // Get base style from first segment
    const baseStyle = processedSegments[0].style;

    return {
      segments: processedSegments,
      text: node.characters,
      style: baseStyle,
      hasMultipleFonts,
      hasMultipleSizes,
      hasMultipleWeights,
      styleOverrides: [],
      fontFamily: baseStyle.fontFamily,
      fontSize: baseStyle.fontSize,
      fontWeight: baseStyle.fontWeight,
      lineHeight: baseStyle.lineHeight,
      letterSpacing: baseStyle.letterSpacing,
      start: 0,
      end: node.characters.length
    };
  }



  /**
   * Validate a batch of text nodes efficiently
   */
  async validateBatch(nodes: TextNode[]): Promise<ValidationResult[]> {
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
  async validate(node: TextNodeWithStyle): Promise<ValidationResult> {
    // Load font if not cached
    if (!this.fontCache.has(node.fontName.family)) {
      await figma.loadFontAsync(node.fontName);
      this.fontCache.add(node.fontName.family);
    }

    // Analyze rich text first
    const richTextAnalysis = await this.analyzeRichText(node);
    const issues: TypographyIssue[] = [];
    
    // Get main frame width first - this determines our responsive context
    const frameWidth = this.getMainFrameWidth(node);
    const breakpointKey = this.getBreakpointKey(frameWidth);
    const sizeCategory = this.getSizeCategory(breakpointKey);
    
    // Get role and style requirements with frame context
    const context = await this.roleAnalyzer.analyzeRole(node);
    context.frameWidth = frameWidth;
    context.breakpointKey = breakpointKey;
    context.sizeCategory = sizeCategory;
    
    const styleRequirements = this.getStyleRequirements(context, node, {
      frameWidth,
      breakpointKey,
      sizeCategory
    });
    
    // Skip validation for rich text segments
    if (!node.getStyledTextSegments && styleRequirements) {
      // Validate font family
      this.validateFontFamily(node, styleRequirements, issues);

      // Validate font size
      this.validateFontSize(node, styleRequirements, issues);

      // Validate font weight
      this.validateFontWeight(node, styleRequirements, issues);

      // Validate line height
      this.validateLineHeight(node, styleRequirements, issues);

      // Validate letter spacing
      this.validateLetterSpacing(node, styleRequirements, issues);

      // Validate text alignment
      this.validateAlignment(node, context, issues);

      // Validate style consistency if rich text
      if (richTextAnalysis) {
        this.validateStyleConsistency(richTextAnalysis, context, issues, node);
      }
    }

    return {
      issues,
      context,
      confidence: context.confidence,
      suggestions: this.generateSuggestions(issues, context),
      node,
      richTextAnalysis,
      styleOverrides: richTextAnalysis ? richTextAnalysis.styleOverrides : []
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
  protected getMainFrameWidth(node: TextNodeWithStyle): number {
    // Start from the node and traverse up to find all frames
    let current: BaseNode | null = node;
    let lastFrame: FrameNode | null = null;

    // Keep traversing up to find the outermost frame
    while (current) {
      if (current.type === 'FRAME') {
        // Update lastFrame if this isn't a component/instance
        const isValidFrame = !current.name.toLowerCase().includes('component') &&
                            !current.name.toLowerCase().includes('instance');
        if (isValidFrame) {
          lastFrame = current as FrameNode;
        }
      }
      current = current.parent;
    }

    // If no frame found in hierarchy, try to find in page
    if (!lastFrame) {
      const pageFrames = figma.currentPage.children.filter(
        node => node.type === 'FRAME' && 
               !node.name.toLowerCase().includes('component') &&
               !node.name.toLowerCase().includes('instance')
      ) as FrameNode[];
      
      // Get the largest frame by width
      if (pageFrames.length > 0) {
        lastFrame = pageFrames.reduce((largest, current) => 
          current.width > largest.width ? current : largest
        );
      }
    }

    const width = lastFrame ? lastFrame.width : 1024;
    console.log('Debug - Main Frame:', {
      width,
      frameName: lastFrame?.name,
      frameType: lastFrame?.type,
      hasMainFrame: !!lastFrame,
      nodeParentType: node.parent?.type,
      nodeParentName: node.parent?.name,
      nodePath: this.getNodePath(node),
      frameHierarchy: this.getFrameHierarchy(node)
    });

    return width;
  }

  private getNodePath(node: BaseNode): string {
    const path: string[] = [];
    let current: BaseNode | null = node;
    
    while (current) {
      path.unshift(`${current.type}:${current.name}`);
      current = current.parent;
    }
    
    return path.join(' > ');
  }

  private getFrameHierarchy(node: BaseNode): string {
    const frames: string[] = [];
    let current: BaseNode | null = node;
    
    while (current) {
      if (current.type === 'FRAME') {
        frames.unshift(`${current.name}(${(current as FrameNode).width}px)`);
      }
      current = current.parent;
    }
    
    return frames.join(' > ');
  }

  private getSizeCategory(breakpointKey: BreakpointKey): 'small' | 'medium' | 'large' {
    switch (breakpointKey) {
      case 'xs':
      case 'sm':
        return 'small';
      case 'md':
        return 'medium';
      case 'lg':
      case 'xl':
        return 'large';
      default:
        return 'medium';
    }
  }

  private getStyleRequirements(
    context: TextContext, 
    node: TextNodeWithStyle,
    frameContext: {
      frameWidth: number;
      breakpointKey: BreakpointKey;
      sizeCategory: 'small' | 'medium' | 'large';
    }
  ) {
    console.log('Debug - getStyleRequirements:', {
      role: context.role,
      nodeName: node.name,
      isTitle: node.name?.toLowerCase().includes('title'),
      frameContext
    });

    // Special handling for titles - treat them as heading1
    if (context.role === 'heading' && node.name?.toLowerCase().includes('title')) {
      const scale = this.config.responsive.scales.heading1 as ComponentScale;
      
      return {
        styleKey: 'heading1',
        fontSize: scale[frameContext.sizeCategory] || [40, 48], // Default to large size if scale not found
        fontWeight: this.config.styles.heading1.fontWeight,
        lineHeight: this.config.styles.heading1.lineHeight,
        letterSpacing: this.config.styles.heading1.letterSpacing,
        alignment: this.config.styles.heading1.alignment
      };
    }

    const contextRule = this.config.contextRules[context.role];
    if (!contextRule) return null;

    const preferredStyle = this.config.styles[contextRule.preferredStyle];
    if (!preferredStyle) return null;

    return {
      ...preferredStyle,
      styleKey: contextRule.preferredStyle,
      allowedStyles: contextRule.allowedStyles.map(style => this.config.styles[style]),
      requiredAlignment: contextRule.requiredAlignment
    };
  }

  /**
   * Analyze rich text for mixed styles
   */
  protected async analyzeRichText(node: TextNodeWithStyle): Promise<RichTextAnalysis | undefined> {
    // Return undefined if getStyledTextSegments is not available
    if (!node.getStyledTextSegments) {
      return undefined;
    }

    // Get text segments with all required properties
    const segments = node.getStyledTextSegments([
      'fontName',
      'fontSize',
      'lineHeight',
      'letterSpacing',
      'textCase',
      'textDecoration',
      'textAlignHorizontal'
    ]);

    // Process each segment
    let currentPosition = 0;
    const processedSegments = segments.map(segment => {
      const segmentLength = segment.characters.length;
      const segmentInfo = {
        text: segment.characters,
        style: {
          fontFamily: segment.fontName.family,
          fontSize: segment.fontSize,
          fontWeight: segment.fontName.style,
          lineHeight: segment.lineHeight?.value,
          letterSpacing: segment.letterSpacing?.value
        },
        start: currentPosition,
        end: currentPosition + segmentLength
      };
      currentPosition += segmentLength;
      return segmentInfo;
    });

    // Check for style variations
    const hasMultipleFonts = new Set(processedSegments.map(s => s.style.fontFamily)).size > 1;
    const hasMultipleSizes = new Set(processedSegments.map(s => s.style.fontSize)).size > 1;
    const hasMultipleWeights = new Set(processedSegments.map(s => s.style.fontWeight)).size > 1;

    // Get combined text and base style
    const text = processedSegments.map(s => s.text).join('');
    const baseSegment = processedSegments[0];

    return {
      segments: processedSegments,
      text,
      style: baseSegment.style,
      fontFamily: baseSegment.style.fontFamily,
      fontSize: baseSegment.style.fontSize,
      fontWeight: baseSegment.style.fontWeight,
      lineHeight: baseSegment.style.lineHeight,
      letterSpacing: baseSegment.style.letterSpacing,
      start: 0,
      end: text.length,
      hasMultipleFonts,
      hasMultipleSizes,
      hasMultipleWeights,
      styleOverrides: []
    };

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
  protected getBreakpointKey(frameWidth: number): BreakpointKey {
    // Fixed breakpoint ranges
    if (frameWidth < 375) return 'xs';
    if (frameWidth < 768) return 'sm';
    if (frameWidth < 1024) return 'md';
    if (frameWidth < 1440) return 'lg';
    return 'xl';
    if (frameWidth <= 1440) return 'lg';
    return 'xl';
    const { breakpoints } = this.config.responsive;
    const breakpointKeys: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl'];

    // Handle special case for xs
    if (frameWidth <= breakpoints.xs.maxWidth) {
      return 'xs';
    }

    // Check other breakpoints
    for (const key of breakpointKeys) {
      const breakpoint = breakpoints[key];
      if (breakpoint.minWidth && frameWidth >= breakpoint.minWidth && 
          (!breakpoint.maxWidth || frameWidth <= breakpoint.maxWidth)) {
        return key;
      }
    }

    return 'xl';  // Default to largest breakpoint
  }

  private getResponsiveScale(frameWidth: number, styleKey: string): number[] {
    const breakpointKey = this.getBreakpointKey(frameWidth);
    const { scales } = this.config.responsive;
    
    console.log('Debug - getResponsiveScale:', {
      frameWidth,
      styleKey,
      breakpointKey
    });

    // Try to get component-specific scale first
    const componentScale = scales[styleKey] as ComponentScale;
    if (componentScale) {
      // Map breakpoint to size category
      let sizeCategory: 'small' | 'medium' | 'large';
      switch (breakpointKey) {
        case 'xs':
        case 'sm':
          sizeCategory = 'small';
          break;
        case 'md':
          sizeCategory = 'medium';
          break;
        case 'lg':
        case 'xl':
          sizeCategory = 'large';
          break;
        default:
          sizeCategory = 'medium';
      }

      console.log('Debug - component scale:', {
        sizeCategory,
        sizes: componentScale[sizeCategory]
      });

      if (componentScale[sizeCategory]) {
        return componentScale[sizeCategory];
      }
    }

    // Fallback to type scale if no component scale
    const scale = scales[breakpointKey];
    if (scale && 'h1' in scale) {
      const typeScale = scale as TypeScale;
      switch (styleKey) {
        case 'heading1':
          return [typeScale.h1];
        case 'heading2':
          return [typeScale.h2];
        case 'heading3':
          return [typeScale.h3];
        case 'body':
          return [typeScale.base];
        case 'button':
          return [typeScale.base];
        case 'caption':
          return [typeScale.small];
        default:
          break;
      }
    }

    return [];
  }

  private validateFontSize(
    node: TextNodeWithStyle, 
    requirements: any, 
    issues: TypographyIssue[]
  ) {
    console.log('Debug - validateFontSize:', {
      nodeName: node.name,
      fontSize: node.fontSize,
      requirements
    });

    if (isMixed(node.fontSize)) return; // Skip mixed sizes, handled by rich text analysis

    const fontSize = node.fontSize;
    // Get the main frame width
    const frameWidth = this.getMainFrameWidth(node);

    // Get responsive scale for this style
    const responsiveScale = this.getResponsiveScale(frameWidth, requirements.styleKey);
    const allowedSizes = responsiveScale.length > 0 ? responsiveScale : requirements.fontSize;

    // For component scales, treat as a range. For type scales, expect exact match
    console.log('Debug - validateFontSize:', {
      fontSize,
      allowedSizes,
      requirements
    });

    // Special handling for titles - treat as range [24, 32]
    const isTitleNode = node.name?.toLowerCase().includes('title');
    const isValidSize = isTitleNode ?
      // Title - allow range [24, 32]
      fontSize >= 24 && fontSize <= 32 :
      // For component scales, treat as a range. For type scales, expect exact match
      allowedSizes.length === 2 ?
        // Component scale - treat as range
        fontSize >= allowedSizes[0] && fontSize <= allowedSizes[1] :
        // Type scale - expect exact match
        allowedSizes.includes(fontSize);

    console.log('Debug - validation:', {
      isTitleNode,
      isValidSize,
      fontSize
    });

    if (requirements && !isValidSize) {
      // Special handling for titles
      if (isTitleNode) {
        issues.push({
          type: 'Invalid Font Size',
          message: `Font size ${fontSize}px is outside the allowed range for titles (24px to 32px)`,
          severity: 'warning',
          code: 'TYPOGRAPHY_INVALID_SIZE',
          node,
          expected: '24-32px',
          actual: fontSize,
          suggestion: `For titles, use a font size between 24px and 32px`
        });
      } else {
        // For ranges, suggest the range bounds
        const suggestions = allowedSizes.length === 2 ?
          [allowedSizes[0], allowedSizes[1]] :
          // For exact matches, find closest and nearby sizes
          allowedSizes
            .filter((size: number) => Math.abs(size - fontSize) <= 16)
            .sort((a: number, b: number) => Math.abs(a - fontSize) - Math.abs(b - fontSize));

        const closestSize = suggestions[0];

        issues.push({
          type: 'Invalid Font Size',
          message: allowedSizes.length === 2 ?
            `Font size ${fontSize}px is outside the allowed range of ${allowedSizes[0]}px to ${allowedSizes[1]}px` :
            `Font size ${fontSize}px is not in the approved sizes`,
          severity: 'warning',
          code: 'TYPOGRAPHY_INVALID_SIZE',
          node,
          expected: allowedSizes.length === 2 ? `${allowedSizes[0]}-${allowedSizes[1]}px` : allowedSizes.join(', '),
          actual: fontSize,
          suggestion: allowedSizes.length === 2 ?
            `Use a size between ${allowedSizes[0]}px and ${allowedSizes[1]}px` :
            `Use ${closestSize}px${suggestions.length > 1 ? ` or one of these sizes: ${suggestions.join(', ')}px` : ''}`
        });
      }
    }
  }

  /**
   * Validate font weight
   */
  private validateFontWeight(
    node: TextNodeWithStyle, 
    requirements: any, 
    issues: TypographyIssue[]
  ) {
    if (isMixed(node.fontName)) return; // Skip mixed weights, handled by rich text analysis

    const fontWeight = node.fontName.style;
    if (requirements && !requirements.fontWeight.includes(fontWeight)) {
      issues.push({
        type: 'Invalid Font Weight',
        message: `Font weight "${fontWeight}" is not recommended`,
        severity: 'warning',
        code: 'TYPOGRAPHY_INVALID_WEIGHT',
        node,
        expected: requirements.fontWeight.join(', '),
        actual: fontWeight,
        suggestion: `Use one of the recommended weights: ${requirements.fontWeight.join(', ')}`
      });
    }
  }

  /**
   * Validate line height
   */
  private validateLineHeight(
    node: TextNodeWithStyle, 
    requirements: any, 
    issues: TypographyIssue[]
  ) {
    if (isMixed(node.lineHeight) || isMixed(node.fontSize)) return; // Skip mixed values

    const fontSize = node.fontSize;
    const normalizedLineHeight = normalizeLineHeight(node.lineHeight, fontSize);
    
    // Helper function to round to nearest even number
    const roundToEven = (num: number): number => {
      const rounded = Math.round(num);
      return rounded % 2 ? rounded + 1 : rounded;
    };

    // Convert ratio requirements to pixels if we have pixel values
    let minHeight: number, maxHeight: number, actualHeight: number;
    if (normalizedLineHeight.unit === 'PIXELS') {
      // We have pixel values, convert requirements to pixels and round to even numbers
      minHeight = roundToEven(requirements.lineHeight.min * fontSize);
      maxHeight = roundToEven(requirements.lineHeight.max * fontSize);
      actualHeight = roundToEven(normalizedLineHeight.value);
    } else {
      // We have ratio values - round the final calculated values
      minHeight = roundToEven(requirements.lineHeight.min * 10) / 10;
      maxHeight = roundToEven(requirements.lineHeight.max * 10) / 10;
      actualHeight = roundToEven(normalizedLineHeight.value * 10) / 10;
    }

    if (requirements && (actualHeight < minHeight || actualHeight > maxHeight)) {
      const unit = normalizedLineHeight.unit === 'PIXELS' ? 'px' : '';
      issues.push({
        type: 'Invalid Line Height',
        message: `Line height ${actualHeight}${unit} is outside recommended range`,
        severity: 'warning',
        code: 'TYPOGRAPHY_INVALID_LINE_HEIGHT',
        node,
        expected: `${minHeight}${unit}-${maxHeight}${unit}`,
        actual: actualHeight,
        suggestion: `Adjust line height to be between ${minHeight}${unit} and ${maxHeight}${unit}`
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
   * Validate text alignment
   */
  private validateAlignment(
    node: TextNodeWithStyle, 
    context: TextContext, 
    issues: TypographyIssue[]
  ) {
    const contextRule = this.config.contextRules[context.role];
    if (!contextRule?.requiredAlignment) return;

    const alignment = node.textAlignHorizontal as TextAlignment;
    if (!contextRule.requiredAlignment.includes(alignment)) {
      issues.push({
        type: 'Invalid Alignment',
        message: `Text alignment "${alignment}" is not recommended for ${context.role}`,
        severity: 'warning',
        code: 'TYPOGRAPHY_INVALID_ALIGNMENT',
        node,
        expected: contextRule.requiredAlignment.join(', '),
        actual: alignment,
        suggestion: `Use ${contextRule.requiredAlignment.join(' or ')} alignment for ${context.role}`
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
    // Check for mixed font families
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

    // Check for inconsistent font weights in headings
    if (context.role === 'heading' && analysis.segments) {
      const weights = new Set(analysis.segments.map(s => s.style.fontWeight));
      if (weights.size > 1) {
        issues.push({
          type: 'Mixed Styles',
          message: 'Inconsistent font weights used in heading',
          severity: 'warning',
          code: 'INCONSISTENT_FONT_WEIGHT',
          node: node,
          suggestion: 'Use consistent font weight within headings'
        });
      }
    }

    if (analysis.hasMultipleSizes && context.role !== 'heading') {
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
