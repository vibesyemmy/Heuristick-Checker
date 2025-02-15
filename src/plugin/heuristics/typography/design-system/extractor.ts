/**
 * Extract typography tokens from design system
 */

import { TypographyToken, DesignSystemTokens } from './types';

export class TokenExtractor {
  /**
   * Extract typography tokens from text styles
   */
  async extractFromTextStyles(styles: TextStyle[]): Promise<DesignSystemTokens> {
    const typography: { [key: string]: TypographyToken } = {};
    const breakpoints = this.detectBreakpoints(styles);

    for (const style of styles) {
      const token = await this.parseTextStyle(style, breakpoints);
      if (token) {
        typography[style.name] = token;
      }
    }

    return {
      typography,
      breakpoints
    };
  }

  /**
   * Parse a text style into a typography token
   */
  private async parseTextStyle(
    style: TextStyle, 
    breakpoints: { [name: string]: { min?: number; max?: number } }
  ): Promise<TypographyToken | null> {
    const role = this.inferRole(style.name);
    if (!role) return null;

    const token: TypographyToken = {
      role,
      breakpoints: {},
      variants: {}
    };

    // Extract base properties
    const baseProps = {
      fontSize: { min: style.fontSize, max: style.fontSize },
      lineHeight: this.parseLineHeight(style.lineHeight),
      letterSpacing: style.letterSpacing?.value,
      fontWeight: style.fontName ? [style.fontName.style] : ['Regular']
    };

    // Add base properties to default breakpoint
    token.breakpoints['default'] = baseProps;

    // Extract variants if they exist
    const variants = this.detectVariants(style.name);
    if (variants) {
      token.variants = variants;
    }

    return token;
  }

  /**
   * Infer text role from style name
   */
  private inferRole(styleName: string): string | null {
    const normalizedName = styleName.toLowerCase();
    
    // Common text role patterns
    const patterns = {
      heading: /heading|h[1-6]|title/,
      body: /body|text|paragraph/,
      caption: /caption|small/,
      button: /button|cta/,
      label: /label|field/
    };

    for (const [role, pattern] of Object.entries(patterns)) {
      if (pattern.test(normalizedName)) {
        return role;
      }
    }

    return null;
  }

  /**
   * Parse line height into a normalized range
   */
  private parseLineHeight(lineHeight: LineHeight): { min: number; max: number } {
    if (!lineHeight) {
      return { min: 1.2, max: 1.5 }; // Default range
    }

    let value: number;
    if (typeof lineHeight === 'number') {
      value = lineHeight;
    } else if ('value' in lineHeight) {
      value = lineHeight.value;
    } else {
      // Default value for AUTO
      value = 1.2;
    }

    return {
      min: value * 0.95, // Allow 5% variation
      max: value * 1.05
    };
  }

  /**
   * Detect breakpoints from style naming patterns
   */
  private detectBreakpoints(styles: TextStyle[]): { [name: string]: { min?: number; max?: number } } {
    const breakpoints: { [name: string]: { min?: number; max?: number } } = {
      default: {}
    };

    // Common breakpoint patterns in style names
    const patterns = {
      mobile: /mobile|sm|small/i,
      tablet: /tablet|md|medium/i,
      desktop: /desktop|lg|large/i
    };

    // Default breakpoint ranges
    const defaultRanges = {
      mobile: { max: 767 },
      tablet: { min: 768, max: 1023 },
      desktop: { min: 1024 }
    };

    // Analyze style names for breakpoint patterns
    for (const style of styles) {
      for (const [name, pattern] of Object.entries(patterns)) {
        if (pattern.test(style.name)) {
          breakpoints[name] = defaultRanges[name as keyof typeof defaultRanges];
        }
      }
    }

    return breakpoints;
  }

  /**
   * Detect variants from style name
   */
  private detectVariants(styleName: string): { [variant: string]: Partial<TypographyToken> } | null {
    const variantPatterns = {
      bold: /bold|strong/i,
      italic: /italic|emphasis/i,
      light: /light|thin/i
    };

    const variants: { [variant: string]: Partial<TypographyToken> } = {};
    let hasVariants = false;

    for (const [variant, pattern] of Object.entries(variantPatterns)) {
      if (pattern.test(styleName)) {
        hasVariants = true;
        variants[variant] = {
          // Variant-specific overrides would go here
        };
      }
    }

    return hasVariants ? variants : null;
  }
}
