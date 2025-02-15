/**
 * Design system detection and analysis
 */

import { DesignSystemInfo, DesignSystemSource, DesignSystemTokens } from './types';

export class DesignSystemDetector {
  private document: DocumentNode;
  private cache: Map<string, DesignSystemInfo>;

  constructor(document: DocumentNode) {
    this.document = document;
    this.cache = new Map();
  }

  /**
   * Detect design system in the current document context
   */
  async detect(): Promise<DesignSystemInfo | null> {
    // 1. Check cache first
    const cacheKey = this.document.id;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 2. Try to detect local design system
    const localSystem = await this.detectLocalSystem();
    
    // 3. Check for linked design systems
    const linkedSystems = await this.detectLinkedSystems();
    
    // 4. Select the best available system
    const bestSystem = this.selectBestSystem([localSystem, ...linkedSystems].filter((system): system is DesignSystemInfo => system !== null));
    
    // 5. Cache the result
    if (bestSystem) {
      this.cache.set(cacheKey, bestSystem);
    }
    
    return bestSystem;
  }

  /**
   * Detect local design system within the current file
   */
  private async detectLocalSystem(): Promise<DesignSystemInfo | null> {
    // Look for design system indicators
    const hasLocalStyles = await this.hasLocalTextStyles();
    const hasDesignSystemPage = await this.findDesignSystemPage();
    
    if (!hasLocalStyles && !hasDesignSystemPage) {
      return null;
    }

    // Extract tokens from local styles
    const tokens = await this.extractLocalTokens();
    
    return {
      source: {
        type: 'local',
        location: {
          page: hasDesignSystemPage?.name,
          lastUpdated: new Date().toISOString()
        },
        status: 'active'
      },
      tokens,
      confidence: this.calculateConfidence(tokens),
      metadata: {
        name: 'Local Design System',
        lastUpdated: new Date().toISOString()
      }
    };
  }

  /**
   * Detect linked design system files
   */
  private async detectLinkedSystems(): Promise<DesignSystemInfo[]> {
    // Note: getLinkedLibraries is not available in all Figma environments
    const linkedFiles = 'getLinkedLibraries' in figma ? await (figma.getLinkedLibraries as () => Promise<any[]>)() : [];
    const systems: DesignSystemInfo[] = [];

    for (const file of linkedFiles) {
      try {
        const tokens = await this.extractExternalTokens(file);
        if (tokens) {
          systems.push({
            source: {
              type: 'external',
              fileKey: file.key,
              location: {
                lastUpdated: new Date().toISOString()
              },
              status: 'active'
            },
            tokens,
            confidence: this.calculateConfidence(tokens),
            metadata: {
              name: file.name,
              lastUpdated: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        console.error(`Failed to extract tokens from ${file.name}:`, error);
      }
    }

    return systems;
  }

  /**
   * Select the most appropriate design system from available options
   */
  private selectBestSystem(systems: DesignSystemInfo[]): DesignSystemInfo | null {
    if (!systems.length) return null;

    // Sort by confidence and recency
    return systems.sort((a, b) => {
      // Prioritize higher confidence
      const confidenceDiff = b.confidence - a.confidence;
      if (confidenceDiff !== 0) return confidenceDiff;

      // If confidence is equal, prefer more recent updates
      return new Date(b.metadata.lastUpdated).getTime() - 
             new Date(a.metadata.lastUpdated).getTime();
    })[0];
  }

  /**
   * Calculate confidence score for detected tokens
   */
  private calculateConfidence(tokens: DesignSystemTokens): number {
    let score = 0;
    const weights = {
      typography: 0.6,
      breakpoints: 0.4
    };

    // Check typography tokens
    if (tokens.typography) {
      const tokenCount = Object.keys(tokens.typography).length;
      score += weights.typography * Math.min(tokenCount / 10, 1);
    }

    // Check breakpoints
    if (tokens.breakpoints) {
      const breakpointCount = Object.keys(tokens.breakpoints).length;
      score += weights.breakpoints * Math.min(breakpointCount / 4, 1);
    }

    return score;
  }

  // Helper methods to be implemented
  private async hasLocalTextStyles(): Promise<boolean> {
    // Note: getTextStyles is not available in all document types
    return 'getTextStyles' in this.document && (this.document.getTextStyles as () => any[])().length > 0;
  }

  private async findDesignSystemPage(): Promise<PageNode | null> {
    // Look for pages with names like "Design System", "Style Guide", etc.
    const designSystemKeywords = ['design system', 'style guide', 'tokens'];
    return this.document.children.find(page => 
      designSystemKeywords.some(keyword => 
        page.name.toLowerCase().includes(keyword)
      )
    ) as PageNode || null;
  }

  private async extractLocalTokens(): Promise<DesignSystemTokens> {
    // Get all local text styles
    if (!('getLocalTextStyles' in figma)) {
      return { typography: {}, breakpoints: {} };
    }

    const textStyles = figma.getLocalTextStyles();
    if (!textStyles.length) {
      return { typography: {}, breakpoints: {} };
    }

    // Extract typography tokens
    const typography: { [key: string]: any } = {};
    const breakpoints: { [key: string]: any } = {
      desktop: { min: 1024 },
      tablet: { min: 768, max: 1023 },
      mobile: { max: 767 }
    };

    for (const style of textStyles) {
      // Parse style name to extract role and breakpoint
      // Expected format: Role/Variant/Breakpoint (e.g. "Heading/H1/Desktop")
      const parts = style.name.split('/');
      if (parts.length < 2) continue;

      const [role, variant, breakpoint = 'desktop'] = parts.map(p => p.trim().toLowerCase());
      
      // Create token key
      const tokenKey = `${role}_${variant}`;
      
      // Initialize token if it doesn't exist
      if (!typography[tokenKey]) {
        typography[tokenKey] = {
          role: role,
          variants: {},
          breakpoints: {}
        };
      }

      // Add style properties for this breakpoint
      typography[tokenKey].breakpoints[breakpoint] = {
        fontSize: {
          min: style.fontSize,
          max: style.fontSize
        },
        lineHeight: style.lineHeight?.unit === 'AUTO' ? 
          { min: 1.2, max: 1.5 } : 
          { min: style.lineHeight.value * 0.95, max: style.lineHeight.value * 1.05 },
        letterSpacing: style.letterSpacing?.value || 0,
        fontFamily: [style.fontName.family],
        fontWeight: [style.fontName.style]
      };
    }

    return {
      typography,
      breakpoints
    };
  }

  private async extractExternalTokens(file: any): Promise<DesignSystemTokens> {
    // Note: Currently, we can only detect that external styles exist,
    // but accessing their properties requires the library to be loaded
    const hasExternalStyles = 'getTextStyles' in this.document && 
      (this.document.getTextStyles as () => any[])().some((style: any) => 
        style.remote && style.libraryName === file.name
      );

    if (!hasExternalStyles) {
      return { typography: {}, breakpoints: {} };
    }

    // For now, we'll create a basic set of typography tokens
    // that will be updated once we can properly access the library
    return {
      typography: {
        heading_h1: {
          role: 'heading',
          variants: {
            regular: {
              breakpoints: {
                desktop: {
                  fontSize: { min: 32, max: 32 },
                  lineHeight: { min: 40, max: 40 },
                  fontWeight: ['Regular']
                }
              }
            }
          },
          breakpoints: {
            desktop: {
              fontSize: { min: 32, max: 32 },
              lineHeight: { min: 40, max: 40 },
              fontWeight: ['Regular']
            }
          }
        },
        body_regular: {
          role: 'body',
          variants: {
            regular: {
              breakpoints: {
                desktop: {
                  fontSize: { min: 16, max: 16 },
                  lineHeight: { min: 24, max: 24 },
                  fontWeight: ['Regular']
                }
              }
            }
          },
          breakpoints: {
            desktop: {
              fontSize: { min: 16, max: 16 },
              lineHeight: { min: 24, max: 24 },
              fontWeight: ['Regular']
            }
          }
        }
      },
      breakpoints: {
        desktop: { min: 1024 },
        tablet: { min: 768, max: 1023 },
        mobile: { max: 767 }
      }
    };
  }
}
