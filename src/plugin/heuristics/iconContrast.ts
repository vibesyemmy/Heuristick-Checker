import { ColorWithOpacity, findOpaqueBackground, convertFigmaColorToHex, calculateContrastRatio } from './contrast';

// Types for icon classification
interface IconMetadata {
    nodeId: string;
    nodeName: string;
    nodeType: 'VECTOR' | 'FRAME' | 'COMPONENT' | 'INSTANCE';
    size: { width: number; height: number };
    isEssential: boolean;  // Based on naming or metadata
    isDecorative: boolean; // Based on naming or metadata
    role: 'interactive' | 'informative' | 'decorative';
}

// Enhanced color tracking for multi-color icons
interface IconColorInfo {
    color: ColorWithOpacity;
    coverage: number;  // Percentage of icon area this color covers
    isStroke: boolean;
    strokeWeight?: number;
    importance: 'primary' | 'secondary' | 'decorative';
}

interface IconAnalysis {
    metadata: IconMetadata;
    colors: IconColorInfo[];
    dominantColor?: IconColorInfo;  // Most prominent/important color
}

interface IconContrastIssue {
    nodeId: string;
    nodeName: string;
    role: 'interactive' | 'informative' | 'decorative';
    colors: {
        original: string;
        blended: string;
        coverage: number;
        contrastRatio: number;
    }[];
    backgroundColor: string;
    requiredRatio: number;  // 3:1 for standard, configurable for stricter requirements
    isCompliant: boolean;
    failingColors?: string[];  // Colors that don't meet contrast requirements
    recommendations: string[];
}

// Common icon sizes in Figma (in pixels)
const COMMON_ICON_SIZES = [16, 24, 32, 48];

/**
 * Determines if a node is likely an icon based on various heuristics
 */
function isIconNode(node: SceneNode): boolean {
    // 1. Name-based detection
    const isNamedIcon = /icon|ico/i.test(node.name);
    const isMarkedIcon = node.name.startsWith('#icon');

    // 2. Structure-based detection
    const isVectorIcon = node.type === 'VECTOR';
    const isVectorGroup = node.type === 'FRAME' && 
        'children' in node && 
        node.children.every(child => child.type === 'VECTOR');
    const isComponent = node.type === 'COMPONENT' || node.type === 'INSTANCE';

    // 3. Size-based detection (common icon sizes)
    const hasIconDimensions = COMMON_ICON_SIZES.includes(Math.round(node.width)) && 
        Math.abs(node.width - node.height) < 1; // Allow for minor differences

    // 4. Parent-based detection (icons often live in specific containers)
    const hasIconParent = node.parent && /icon|button/i.test(node.parent.name);

    return (isNamedIcon || isMarkedIcon || hasIconParent) || 
        ((isVectorIcon || isVectorGroup || isComponent) && hasIconDimensions);
}

/**
 * Determines the role of an icon based on its context and properties
 */
function determineIconRole(node: SceneNode): IconMetadata['role'] {
    // Check explicit role markers in name
    if (node.name.includes('#interactive')) return 'interactive';
    if (node.name.includes('#decorative')) return 'decorative';
    
    // Check parent context
    const parent = node.parent;
    if (parent) {
        // Icons in buttons or interactive components are likely interactive
        if (/button|link|control|input/i.test(parent.name)) {
            return 'interactive';
        }
    }

    // Check if it's part of a component set that suggests interactivity
    let current: BaseNode | null = node;
    while (current) {
        if (current.type === 'COMPONENT' || current.type === 'INSTANCE') {
            if (/button|control|navigation|menu|tab|checkbox|radio/i.test(current.name)) {
                return 'interactive';
            }
        }
        current = current.parent;
    }

    // Default to informative unless explicitly marked as decorative
    return 'informative';
}

/**
 * Classifies an icon node and gathers its metadata
 */
function classifyIcon(node: SceneNode): IconMetadata {
    const role = determineIconRole(node);
    
    return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type as IconMetadata['nodeType'],
        size: { 
            width: node.width, 
            height: node.height 
        },
        isEssential: role !== 'decorative',
        isDecorative: role === 'decorative',
        role
    };
}

/**
 * Calculates the approximate coverage area of a fill in an icon
 */
function calculateCoverage(node: SceneNode): number {
    // For now, return a simple approximation
    // In a more sophisticated version, we could calculate actual area coverage
    return 1 / (('children' in node ? node.children.length : 1));
}

/**
 * Determines the importance of a fill color in an icon
 */
function determineFillImportance(node: SceneNode): IconColorInfo['importance'] {
    // If it's the only color, it's primary
    if (!('children' in node) || node.children.length === 1) {
        return 'primary';
    }

    // If it's marked as background or secondary, treat it as such
    if (/background|secondary/i.test(node.name)) {
        return 'secondary';
    }

    // If it's marked as decorative, treat it as such
    if (/decorative|accent/i.test(node.name)) {
        return 'decorative';
    }

    // Default to primary
    return 'primary';
}

/**
 * Analyzes an icon node and extracts its color information
 */
function analyzeIcon(node: SceneNode): IconAnalysis | null {
    if (!isIconNode(node)) return null;

    const metadata = classifyIcon(node);
    const colors: IconColorInfo[] = [];

    function processNode(node: SceneNode) {
        if ('fills' in node && node.fills) {
            const fills = node.fills;
            if (fills !== figma.mixed) {
                fills.forEach(fill => {
                    if (fill.type === 'SOLID' && fill.visible !== false) {
                        // Get node opacity safely
                        const nodeOpacity = 'opacity' in node ? (node.opacity ?? 1) : 1;
                        
                        colors.push({
                            color: {
                                color: fill.color,
                                fillOpacity: fill.opacity ?? 1,
                                layerOpacity: nodeOpacity
                            },
                            coverage: calculateCoverage(node),
                            isStroke: false,
                            importance: determineFillImportance(node)
                        });
                    }
                });
            }
        }

        // Process children recursively
        if ('children' in node) {
            node.children.forEach(processNode);
        }
    }

    processNode(node);

    // Find dominant color (primary color with highest coverage)
    const dominantColor = colors
        .filter(c => c.importance === 'primary')
        .sort((a, b) => b.coverage - a.coverage)[0];

    return {
        metadata,
        colors,
        dominantColor
    };
}

export function evaluateIconContrast(node: SceneNode): IconContrastIssue[] {
    const issues: IconContrastIssue[] = [];

    function traverse(node: SceneNode) {
        const iconAnalysis = analyzeIcon(node);
        
        if (iconAnalysis) {
            const background = findOpaqueBackground(node);
            const backgroundHex = convertFigmaColorToHex(background);

            // Analyze each color's contrast
            const colorAnalysis = iconAnalysis.colors.map(colorInfo => {
                const originalHex = convertFigmaColorToHex(colorInfo.color);
                const blendedHex = convertFigmaColorToHex(colorInfo.color, background);
                const contrastRatio = calculateContrastRatio(blendedHex, backgroundHex);

                return {
                    original: originalHex,
                    blended: blendedHex,
                    coverage: colorInfo.coverage,
                    contrastRatio
                };
            });

            // Determine required ratio based on role
            const requiredRatio = iconAnalysis.metadata.role === 'interactive' ? 4.5 : 3;
            
            // Check compliance
            const failingColors = colorAnalysis
                .filter(c => c.contrastRatio < requiredRatio)
                .map(c => c.original);

            if (failingColors.length > 0) {
                issues.push({
                    nodeId: iconAnalysis.metadata.nodeId,
                    nodeName: iconAnalysis.metadata.nodeName,
                    role: iconAnalysis.metadata.role,
                    colors: colorAnalysis,
                    backgroundColor: backgroundHex,
                    requiredRatio,
                    isCompliant: false,
                    failingColors,
                    recommendations: generateIconRecommendations(
                        colorAnalysis,
                        backgroundHex,
                        requiredRatio,
                        iconAnalysis
                    )
                });
            }
        }

        // Traverse children
        if ('children' in node) {
            node.children.forEach(traverse);
        }
    }

    traverse(node);
    return issues;
}

/**
 * Generates recommendations for improving icon contrast
 */
function generateIconRecommendations(
    colorAnalysis: { original: string; blended: string; coverage: number; contrastRatio: number }[],
    backgroundColor: string,
    requiredRatio: number,
    iconAnalysis: IconAnalysis
): string[] {
    const recommendations: string[] = [];

    // Add role-specific recommendations
    if (iconAnalysis.metadata.role === 'interactive') {
        recommendations.push(
            'This is an interactive icon and requires a higher contrast ratio (4.5:1). ' +
            'Consider increasing its visibility since users need to interact with it.'
        );
    }

    // Add specific color recommendations
    colorAnalysis.forEach(color => {
        if (color.contrastRatio < requiredRatio) {
            const difference = requiredRatio - color.contrastRatio;
            recommendations.push(
                `Increase the contrast of color ${color.original} (currently ${color.contrastRatio.toFixed(2)}:1, ` +
                `needs ${difference.toFixed(2)} more to meet ${requiredRatio}:1 requirement).`
            );
        }
    });

    // Add general recommendations
    if (recommendations.length > 0) {
        recommendations.push(
            'Consider one of these approaches:',
            '1. Increase the color contrast by adjusting the icon color',
            '2. Add a background shape behind the icon',
            '3. Increase the icon size to improve visibility',
            '4. If the icon is decorative, consider marking it as such (#decorative)'
        );
    }

    return recommendations;
}
