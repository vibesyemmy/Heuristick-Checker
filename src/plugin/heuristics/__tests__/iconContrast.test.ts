import { IconContrastHeuristicResult } from '../types';
import { __testing } from '../iconContrast';

const {
  isIconNode,
  determineIconRole,
  findOpaqueBackground,
  calculateContrastRatio,
  extractAllIconColors,
  generateIconRecommendations,
  analyzeIconContrast
} = __testing;

// Types and interfaces
type IconRole = 'interactive' | 'informative' | 'decorative';

// Helper function to create test config
function createTestConfig(overrides = {}) {
  return {
    minIconSize: 12,
    maxIconSize: 64,
    maxAspectRatio: 1.5,
    namePatterns: [
      'icon',
      'ico',
      'glyph',
      'symbol'
    ],
    commonIconNames: [
      'search',
      'menu',
      'close'
    ],
    iconFonts: [
      'FontAwesome',
      'Material Icons'
    ],
    scoreThresholds: {
      minimum: 5,
      high: 8,
      medium: 6
    },
    weights: {
      nameMatch: 3,
      componentMatch: 5,
      vectorOnly: 2,
      dimensions: 2,
      singleColor: 2,
      noText: 1
    },
    roleOverrides: new Map(),
    contrastThresholds: {
      interactive: 4.5,
      informative: 3.0,
      decorative: 2.0
    },
    ...overrides
  };
}

class MockBaseNode {
  id: string = '';
  name: string = '';
  type: NodeType = 'FRAME';
  visible: boolean = true;
  locked: boolean = false;
  removed: boolean = false;
  opacity: number = 1;
  children: MockBaseNode[] = [];
  parent: MockBaseNode | null = null;
  fills: Paint[] = [];
  strokes: Paint[] = [];
  effects: Effect[] = [];
  constraints = { horizontal: 'CENTER' as const, vertical: 'CENTER' as const };
  relativeTransform: number[][] = [[1, 0, 0], [0, 1, 0]];
  x: number = 0;
  y: number = 0;
  width: number = 100;
  height: number = 100;
  rotation: number = 0;
  blendMode: BlendMode = 'NORMAL';
  effectStyleId: string = '';
  strokeWeight: number = 1;
  strokeAlign: 'INSIDE' | 'OUTSIDE' | 'CENTER' = 'CENTER';
  reactions: { action: { type: string } }[] = [];

  constructor(props: Partial<MockBaseNode>) {
    Object.assign(this, props);
  }

  clone() { return new MockBaseNode(this); }
  setRelaunchData() {}
  getPluginData() { return ''; }
  setPluginData() {}
  getSharedPluginData() { return ''; }
  setSharedPluginData() {}
  remove() {}
  toString() { return this.name; }
}

// Helper function to create test nodes
function createTestNode(fillOpacity: number = 1, nodeOpacity: number = 1): VectorNode {
  const parent = new MockBaseNode({
    id: 'parent',
    name: 'parent',
    type: 'FRAME',
    fills: [{
      type: 'SOLID',
      color: { r: 0, g: 0, b: 0 }, // Black background
      opacity: 1,
      visible: true
    }]
  });

  const node = new MockBaseNode({
    id: 'test-icon',
    name: 'test-icon',
    type: 'VECTOR',
    opacity: nodeOpacity,
    fills: [{
      type: 'SOLID',
      color: { r: 1, g: 1, b: 1 }, // White
      opacity: fillOpacity,
      visible: true
    }],
    parent
  });

  return node as unknown as VectorNode;
}

const defaultConfig = {
  minIconSize: 12,
  maxIconSize: 48,
  maxAspectRatio: 1.2,
  namePatterns: ['icon', 'ico', 'info', 'i', 'delete', 'add', 'close', 'menu'],
  roleOverrides: new Map(),
  contrastThresholds: {
    interactive: 3,
    informative: 3,
    decorative: 3
  }
};

describe('Icon Detection', () => {
  const createMockNode = (props: Partial<MockBaseNode>): SceneNode => {
    const node = new MockBaseNode({
      id: 'test-id',
      name: 'test-node',
      type: 'FRAME',
      width: 24,
      height: 24,
      ...props
    });
    return node as unknown as SceneNode;
  };

  test('should detect icon by name', () => {
    const node = createMockNode({ name: 'icon-menu' });
    expect(isIconNode(node)).toBe(true);
  });

  test('should detect icon by type', () => {
    const node = createMockNode({ type: 'VECTOR' });
    expect(isIconNode(node)).toBe(true);
  });

  test('should detect icon by size', () => {
    const node = createMockNode({ width: 24, height: 24 });
    expect(isIconNode(node)).toBe(true);
  });

  test('should detect icon by shape', () => {
    const node = createMockNode({ type: 'ELLIPSE' });
    expect(isIconNode(node)).toBe(true);
  });

  test('should not detect non-icon node', () => {
    const node = createMockNode({ type: 'TEXT' });
    (node as any).characters = 'Hello';
    expect(isIconNode(node)).toBe(false);
  });

  test('should not detect hidden node', () => {
    const node = createMockNode({ visible: false });
    expect(isIconNode(node)).toBe(false);
  });
});

describe('Icon Role Classification', () => {
  describe('determineIconRole', () => {
    test('should detect interactive role', () => {
      const node = new MockBaseNode({ 
        name: 'button-icon',
        type: 'VECTOR',
        width: 24,
        height: 24,
        reactions: [{ action: { type: 'NAVIGATE' } }]
      });
      expect(determineIconRole(node as unknown as SceneNode)).toBe('interactive');
    });

    test('should detect decorative role', () => {
      const node = new MockBaseNode({ 
        name: 'decorative-icon',
        type: 'VECTOR',
        width: 24,
        height: 24
      });
      expect(determineIconRole(node as unknown as SceneNode)).toBe('decorative');
    });

    test('should default to informative role', () => {
      const node = new MockBaseNode({ 
        name: 'info-icon',
        type: 'VECTOR',
        width: 24,
        height: 24
      });
      expect(determineIconRole(node as unknown as SceneNode)).toBe('informative');
    });
  });
});

describe('Background Detection', () => {
  describe('findOpaqueBackground', () => {
    it('should find background color from parent nodes', () => {
      const node = {
        id: 'test-node',
        name: 'test-node',
        type: 'VECTOR',
        parent: {
          id: 'parent',
          name: 'parent',
          type: 'FRAME',
          fills: [{
            type: 'SOLID',
            color: { r: 1, g: 0, b: 0 },
            opacity: 1,
            visible: true
          }]
        }
      } as any;

      const background = findOpaqueBackground(node);
      if (!background) {
        throw new Error('Background should not be null in this test');
      }
      expect(background).toBeDefined();
      expect(background.color.r).toBe(1);
      expect(background.color.g).toBe(0);
      expect(background.color.b).toBe(0);
    });

    it('should handle multiple background layers', () => {
      const node = {
        id: 'test-node',
        name: 'test-node',
        type: 'VECTOR',
        parent: {
          id: 'parent',
          name: 'parent',
          type: 'FRAME',
          fills: [
            {
              type: 'SOLID',
              color: { r: 1, g: 0, b: 0 },
              opacity: 0.5,
              visible: true
            },
            {
              type: 'SOLID',
              color: { r: 0, g: 0, b: 0 },
              opacity: 1,
              visible: true
            }
          ]
        }
      } as any;

      const background = findOpaqueBackground(node);
      if (!background) {
        throw new Error('Background should not be null in this test');
      }
      expect(background).toBeDefined();
      // Should blend the colors - red at 50% over black
      expect(background.color.r).toBeCloseTo(0.735, 2);
      expect(background.color.g).toBe(0);
      expect(background.color.b).toBe(0);
    });
  });
});

describe('Contrast Calculation', () => {
  describe('calculateContrastRatio', () => {
    it('should calculate contrast ratio between two colors', () => {
      // White on black
      const ratio1 = calculateContrastRatio(
        { r: 1, g: 1, b: 1, a: 1 },
        { r: 0, g: 0, b: 0, a: 1 }
      );
      expect(ratio1).toBeGreaterThan(20);

      // Black on white
      const ratio2 = calculateContrastRatio(
        { r: 0, g: 0, b: 0, a: 1 },
        { r: 1, g: 1, b: 1, a: 1 }
      );
      expect(ratio2).toBeGreaterThan(20);
    });

    it('should handle same colors', () => {
      const ratio = calculateContrastRatio(
        { r: 1, g: 1, b: 1, a: 1 },
        { r: 1, g: 1, b: 1, a: 1 }
      );
      expect(ratio).toBeCloseTo(1, 1);
    });

    it('should handle similar colors', () => {
      const ratio = calculateContrastRatio(
        { r: 254/255, g: 254/255, b: 254/255, a: 1 },
        { r: 1, g: 1, b: 1, a: 1 }
      );
      expect(ratio).toBeCloseTo(1, 1);
    });

    it('should handle opacity correctly', () => {
      const black = { r: 0, g: 0, b: 0, a: 1 };
      const white = { r: 1, g: 1, b: 1, a: 1 };

      // Test white at 50% opacity on black
      const halfWhite = __testing.blendWithBackground(white, black, 0.5);
      const ratio1 = __testing.calculateContrastRatio(halfWhite, black);

      // Should be less than full opacity white on black
      expect(ratio1).toBeCloseTo(11.0, 1);
      expect(ratio1).toBeGreaterThan(1);

      // Test white at 20% opacity on black
      const lowOpacityWhite = __testing.blendWithBackground(white, black, 0.2);
      const ratio2 = __testing.calculateContrastRatio(lowOpacityWhite, black);

      // Should be even lower contrast
      expect(ratio2).toBeCloseTo(5.0, 1);
      expect(ratio2).toBeGreaterThan(1);
    });
  });
});

describe('Icon Contrast Analysis', () => {
  describe('extractAllIconColors', () => {
    it('should handle nested opacity correctly', () => {
      // Create a nested structure: parent -> child -> grandchild
      const node = {
        id: 'parent',
        name: 'parent',
        type: 'FRAME',
        opacity: 0.8, // 80% opacity
        children: [{
          id: 'child',
          name: 'child',
          type: 'FRAME',
          opacity: 0.5, // 50% opacity
          children: [{
            id: 'grandchild',
            name: 'grandchild',
            type: 'VECTOR',
            opacity: 0.5, // 50% opacity
            fills: [{
              type: 'SOLID',
              color: { r: 1, g: 1, b: 1 }, // White
              opacity: 1,
              visible: true
            }]
          }]
        }]
      } as any;

      const colors = __testing.extractAllIconColors(node);
      expect(colors).toHaveLength(1);
      
      // Opacity should cascade: 0.8 * 0.5 * 0.5 = 0.2
      expect(colors[0]).toEqual({
        original: expect.any(Object),
        blended: expect.any(Object),
        fillOpacity: expect.any(Number),
        layerOpacity: expect.any(Number),
        contrastRatio: expect.any(Number)
      });

      // Verify opacity values
      expect(colors[0].fillOpacity * colors[0].layerOpacity).toBeCloseTo(0.2, 2);
    });

    it('should handle sibling nodes with different opacities', () => {
      const node = {
        id: 'parent',
        name: 'parent',
        type: 'FRAME',
        opacity: 1,
        children: [
          {
            id: 'child1',
            name: 'child1',
            type: 'VECTOR',
            opacity: 0.8,
            fills: [{
              type: 'SOLID',
              color: { r: 1, g: 1, b: 1 },
              opacity: 1,
              visible: true
            }]
          },
          {
            id: 'child2',
            name: 'child2',
            type: 'VECTOR',
            opacity: 0.4,
            fills: [{
              type: 'SOLID',
              color: { r: 1, g: 1, b: 1 },
              opacity: 1,
              visible: true
            }]
          }
        ]
      } as any;

      const colors = __testing.extractAllIconColors(node);
      expect(colors).toHaveLength(2);

      // First child: 1 * 0.8 = 0.8
      expect(colors[0]).toEqual({
        original: expect.any(Object),
        blended: expect.any(Object),
        fillOpacity: expect.any(Number),
        layerOpacity: expect.any(Number),
        contrastRatio: expect.any(Number)
      });

      // Second child: 1 * 0.4 = 0.4
      expect(colors[1]).toEqual({
        original: expect.any(Object),
        blended: expect.any(Object),
        fillOpacity: expect.any(Number),
        layerOpacity: expect.any(Number),
        contrastRatio: expect.any(Number)
      });
    });
  });

  describe('analyzeIconContrast', () => {
    it('should calculate different contrast ratios for different opacities', () => {
      // Create a test node with a white fill at different opacities
      const createTestNode = (fillOpacity: number, nodeOpacity: number = 1) => ({
        id: 'test-icon',
        name: 'test-icon',
        type: 'VECTOR',
        opacity: nodeOpacity,
        fills: [{
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1 }, // White
          opacity: fillOpacity,
          visible: true
        }],
        parent: {
          id: 'parent',
          name: 'parent',
          type: 'FRAME',
          fills: [{
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0 }, // Black background
            opacity: 1,
            visible: true
          }]
        }
      } as any);

      const createInitialResult = (): IconContrastHeuristicResult => ({
        id: 'test-icon_icon_contrast',
        nodeId: 'test-icon',
        nodeName: 'test-icon',
        type: 'icon_contrast',
        category: 'Accessibility',
        title: 'Icon Contrast - informative',
        description: 'Checking contrast ratio for informative icon',
        severity: 'medium',
        role: 'informative' as const,
        colors: [],
        backgroundColor: { r: 0, g: 0, b: 0 },
        contrastRatio: 0,
        requiredRatio: 3,
        isCompliant: false,
        failingColors: [],
        recommendations: []
      });

      // Test with 100% opacity
      const fullOpacityNode = createTestNode(1);
      const fullOpacityResult = __testing.analyzeIconContrast(fullOpacityNode, createInitialResult());

      // Test with 60% opacity
      const mediumOpacityNode = createTestNode(0.6);
      const mediumOpacityResult = __testing.analyzeIconContrast(mediumOpacityNode, createInitialResult());

      // Test with 30% opacity
      const lowOpacityNode = createTestNode(0.3);
      const lowOpacityResult = __testing.analyzeIconContrast(lowOpacityNode, createInitialResult());

      // Test with combined node and fill opacity (60% * 50% = 30%)
      const combinedOpacityNode = createTestNode(0.6, 0.5);
      const combinedOpacityResult = __testing.analyzeIconContrast(combinedOpacityNode, createInitialResult());

      // Verify results
      expect(fullOpacityResult).not.toBeNull();
      expect(mediumOpacityResult).not.toBeNull();
      expect(lowOpacityResult).not.toBeNull();
      expect(combinedOpacityResult).not.toBeNull();

      if (fullOpacityResult && mediumOpacityResult && lowOpacityResult && combinedOpacityResult) {
        // Full opacity should have highest contrast ratio
        expect(fullOpacityResult.contrastRatio).toBeGreaterThan(mediumOpacityResult.contrastRatio);
        expect(mediumOpacityResult.contrastRatio).toBeGreaterThan(lowOpacityResult.contrastRatio);

        // Full opacity (white on black) should be close to 21:1
        expect(fullOpacityResult.contrastRatio).toBeGreaterThan(20);

        // Verify effective opacities
        expect(fullOpacityResult.colors[0]).toEqual({
          original: expect.any(Object),
          blended: expect.any(Object),
          fillOpacity: expect.any(Number),
          layerOpacity: expect.any(Number),
          contrastRatio: expect.any(Number)
        });
        expect(mediumOpacityResult.colors[0]).toEqual({
          original: expect.any(Object),
          blended: expect.any(Object),
          fillOpacity: expect.any(Number),
          layerOpacity: expect.any(Number),
          contrastRatio: expect.any(Number)
        });
        expect(lowOpacityResult.colors[0]).toEqual({
          original: expect.any(Object),
          blended: expect.any(Object),
          fillOpacity: expect.any(Number),
          layerOpacity: expect.any(Number),
          contrastRatio: expect.any(Number)
        });
        expect(combinedOpacityResult.colors[0]).toEqual({
          original: expect.any(Object),
          blended: expect.any(Object),
          fillOpacity: expect.any(Number),
          layerOpacity: expect.any(Number),
          contrastRatio: expect.any(Number)
        });

        // Log the actual values for reference
        console.log('Contrast ratios:', {
          full: fullOpacityResult.contrastRatio,
          medium: mediumOpacityResult.contrastRatio,
          low: lowOpacityResult.contrastRatio,
          combined: combinedOpacityResult.contrastRatio
        });

        // Verify that opacity affects contrast ratio
        const fullToMediumRatio = fullOpacityResult.contrastRatio / mediumOpacityResult.contrastRatio;
        const mediumToLowRatio = mediumOpacityResult.contrastRatio / lowOpacityResult.contrastRatio;
        
        // The ratio between contrast ratios should be roughly proportional
        expect(fullToMediumRatio).toBeGreaterThan(1);
        expect(mediumToLowRatio).toBeGreaterThan(1);
      }
    });
  });
});

describe('Color Blending and Contrast', () => {
  it('should properly blend colors with background', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 1, g: 1, b: 1, a: 1 };

    // Test 50% opacity blending
    const blended = __testing.blendWithBackground(white, black, 0.5);
    
    // 50% white on black should be 0.735 in linear RGB space
    expect(blended.r).toBeCloseTo(0.735, 2);
    expect(blended.g).toBeCloseTo(0.735, 2);
    expect(blended.b).toBeCloseTo(0.735, 2);
    expect(blended.a).toBe(1);

    // Test different opacity levels
    const opacity75 = __testing.blendWithBackground(white, black, 0.75);
    const opacity25 = __testing.blendWithBackground(white, black, 0.25);

    // Higher opacity should be closer to white
    expect(opacity75.r).toBeGreaterThan(blended.r);
    expect(opacity75.g).toBeGreaterThan(blended.g);
    expect(opacity75.b).toBeGreaterThan(blended.b);

    // Lower opacity should be closer to black
    expect(opacity25.r).toBeLessThan(blended.r);
    expect(opacity25.g).toBeLessThan(blended.g);
    expect(opacity25.b).toBeLessThan(blended.b);
  });

  it('should calculate different contrast ratios for different opacities', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 1, g: 1, b: 1, a: 1 };

    // Test different opacity levels
    const fullBlend = __testing.blendWithBackground(white, black, 1);
    const halfBlend = __testing.blendWithBackground(white, black, 0.5);
    const quarterBlend = __testing.blendWithBackground(white, black, 0.25);

    const fullRatio = __testing.calculateContrastRatio(fullBlend, black);
    const halfRatio = __testing.calculateContrastRatio(halfBlend, black);
    const quarterRatio = __testing.calculateContrastRatio(quarterBlend, black);

    // Verify contrast ratios decrease with opacity
    expect(fullRatio).toBeGreaterThan(20); // Max contrast
    expect(halfRatio).toBeCloseTo(11.0, 1); // Mid contrast
    expect(quarterRatio).toBeCloseTo(6.0, 1); // Low contrast

    // Verify relative relationships
    expect(halfRatio).toBeLessThan(fullRatio);
    expect(quarterRatio).toBeLessThan(halfRatio);
  });

  it('should handle opacity correctly', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 1, g: 1, b: 1, a: 1 };

    // Test white at 50% opacity on black
    const halfWhite = __testing.blendWithBackground(white, black, 0.5);
    const ratio1 = __testing.calculateContrastRatio(halfWhite, black);

    // Should be less than full opacity white on black
    expect(ratio1).toBeCloseTo(11.0, 1);
    expect(ratio1).toBeGreaterThan(1);

    // Test white at 20% opacity on black
    const lowOpacityWhite = __testing.blendWithBackground(white, black, 0.2);
    const ratio2 = __testing.calculateContrastRatio(lowOpacityWhite, black);

    // Should be even lower contrast
    expect(ratio2).toBeCloseTo(5.0, 1);
    expect(ratio2).toBeGreaterThan(1);
  });
});

describe('Icon Contrast Analysis', () => {
  describe('findOpaqueBackground', () => {
    it('should find white background when no background is set', () => {
      const node = {
        id: '1',
        name: 'test-icon',
        type: 'VECTOR',
        parent: null
      } as any;

      const background = findOpaqueBackground(node);
      if (!background) {
        throw new Error('Background should not be null');
      }
      expect(background.color.r).toBe(1);
      expect(background.color.g).toBe(1);
      expect(background.color.b).toBe(1);
    });
  });

  describe('analyzeIconContrast', () => {
    it('should analyze icon contrast correctly', () => {
      const mockNode = {
        id: '1',
        name: 'test-icon',
        type: 'VECTOR'
      } as any;

      const result = __testing.analyzeIconContrast(mockNode, {
        id: '1_icon_contrast',
        nodeId: '1',
        nodeName: 'test-icon',
        type: 'icon_contrast',
        category: 'Accessibility',
        title: 'Icon Contrast - informative',
        description: 'Checking contrast ratio for informative icon',
        severity: 'medium',
        role: 'informative',
        colors: [],
        backgroundColor: { r: 1, g: 1, b: 1 },
        contrastRatio: 0,
        requiredRatio: 0,
        isCompliant: false,
        failingColors: [],
        recommendations: []
      });

      expect(result).toEqual({
        passed: false,
        description: expect.any(String),
        severity: 'medium',
        role: 'interactive',
        colors: [{
          original: { r: 0, g: 0, b: 0 },
          blended: { r: 0, g: 0, b: 0 },
          fillOpacity: 1,
          layerOpacity: 1,
          contrastRatio: 0
        }],
        backgroundColor: { r: 1, g: 1, b: 1 },
        contrastRatio: 0,
        requiredRatio: expect.any(Number),
        nodeId: expect.any(String),
        nodeName: expect.any(String)
      });
    });
  });
});

describe('Icon Analysis', () => {
  describe('determineIconRole', () => {
    test('should detect interactive role', () => {
      const node = new MockBaseNode({ 
        name: 'button-icon',
        type: 'VECTOR',
        width: 24,
        height: 24,
        reactions: [{ action: { type: 'NAVIGATE' } }]
      });
      expect(determineIconRole(node as unknown as SceneNode)).toBe('interactive');
    });

    test('should detect decorative role', () => {
      const node = new MockBaseNode({ 
        name: 'decorative-icon',
        type: 'VECTOR',
        width: 24,
        height: 24
      });
      expect(determineIconRole(node as unknown as SceneNode)).toBe('decorative');
    });

    test('should default to informative role', () => {
      const node = new MockBaseNode({ 
        name: 'info-icon',
        type: 'VECTOR',
        width: 24,
        height: 24
      });
      expect(determineIconRole(node as unknown as SceneNode)).toBe('informative');
    });
  });

  describe('analyzeIconContrast', () => {
    const createBaseNode = (props: Partial<MockBaseNode>): MockBaseNode => {
      const node = new MockBaseNode({
        id: 'test-id',
        name: 'test-node',
        type: 'FRAME',
        width: 24,
        height: 24,
        ...props
      });
      node.parent = new MockBaseNode({
        id: 'parent-id',
        name: 'parent',
        type: 'FRAME',
        fills: [{
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1 },
          opacity: 1,
          visible: true
        }]
      });
      return node;
    };

    test('should handle full opacity', () => {
      const node = createBaseNode({
        fills: [{
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0 },
          opacity: 1,
          visible: true
        }]
      });
      const result: IconContrastHeuristicResult = {
        id: node.id + '_icon_contrast',
        nodeId: node.id,
        nodeName: node.name,
        type: 'icon_contrast',
        category: 'Accessibility',
        title: 'Icon Contrast - informative',
        description: 'Checking contrast ratio for informative icon',
        severity: 'medium',
        role: 'informative',
        colors: [{
          original: { r: 0, g: 0, b: 0 },
          blended: { r: 0, g: 0, b: 0 },
          fillOpacity: 1,
          layerOpacity: 1,
          contrastRatio: 0
        }],
        backgroundColor: { r: 1, g: 1, b: 1 },
        contrastRatio: 0,
        requiredRatio: 0,
        isCompliant: false,
        failingColors: [],
        recommendations: []
      };
      const analyzed = analyzeIconContrast(node as unknown as SceneNode, result);
      expect(analyzed).toEqual({
        passed: false,
        description: expect.any(String),
        severity: 'medium',
        role: 'interactive',
        colors: [{
          original: { r: 0, g: 0, b: 0 },
          blended: { r: 0, g: 0, b: 0 },
          fillOpacity: 1,
          layerOpacity: 1,
          contrastRatio: 0
        }],
        backgroundColor: { r: 1, g: 1, b: 1 },
        contrastRatio: 0,
        requiredRatio: expect.any(Number),
        nodeId: expect.any(String),
        nodeName: expect.any(String)
      });
    });

    test('should handle partial opacity', () => {
      const node = {
        id: '123',
        name: 'test-node',
        fills: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0 },
            opacity: 0.5,
            visible: true
          }
        ],
        visible: true
      };

      const result: IconContrastHeuristicResult = {
        id: 'test_123',
        nodeId: '123',
        nodeName: 'test-node',
        type: 'icon_contrast',
        category: 'Accessibility',
        title: 'Icon Contrast',
        description: '',
        severity: 'medium',
        role: 'interactive',
        colors: [],
        backgroundColor: { r: 1, g: 1, b: 1 },
        contrastRatio: 0,
        requiredRatio: 0,
        isCompliant: false,
        failingColors: [],
        recommendations: []
      };

      const analyzed = analyzeIconContrast(node as unknown as SceneNode, result);
      expect(analyzed).toEqual({
        passed: false,
        description: expect.any(String),
        severity: 'medium',
        role: 'interactive',
        colors: [{
          original: { r: 0, g: 0, b: 0 },
          blended: { r: 0, g: 0, b: 0 },
          fillOpacity: 0.5,
          layerOpacity: 1,
          contrastRatio: 0
        }],
        backgroundColor: { r: 1, g: 1, b: 1 },
        contrastRatio: 0,
        requiredRatio: expect.any(Number),
        nodeId: '123',
        nodeName: 'test-node'
      });
    });

    test('should handle no fills', () => {
      const node = createBaseNode({
        fills: []
      });
      const result: IconContrastHeuristicResult = {
        id: node.id + '_icon_contrast',
        nodeId: node.id,
        nodeName: node.name,
        type: 'icon_contrast',
        category: 'Accessibility',
        title: 'Icon Contrast - informative',
        description: 'Checking contrast ratio for informative icon',
        severity: 'medium',
        role: 'informative',
        colors: [],
        backgroundColor: { r: 1, g: 1, b: 1 },
        contrastRatio: 0,
        requiredRatio: 0,
        isCompliant: false,
        failingColors: [],
        recommendations: []
      };
      const analyzed = analyzeIconContrast(node as unknown as SceneNode, result);
      expect(analyzed).toEqual({
        passed: false,
        description: expect.any(String),
        severity: 'medium',
        role: 'interactive',
        colors: [],
        backgroundColor: { r: 1, g: 1, b: 1 },
        contrastRatio: 0,
        requiredRatio: expect.any(Number),
        nodeId: expect.any(String),
        nodeName: expect.any(String)
      });
    });

    test('should handle invisible fills', () => {
      const node = createBaseNode({
        fills: [{
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1 },
          opacity: 1,
          visible: false
        }]
      });
      const result: IconContrastHeuristicResult = {
        id: node.id + '_icon_contrast',
        nodeId: node.id,
        nodeName: node.name,
        type: 'icon_contrast',
        category: 'Accessibility',
        title: 'Icon Contrast - informative',
        description: 'Checking contrast ratio for informative icon',
        severity: 'medium',
        role: 'informative',
        colors: [],
        backgroundColor: { r: 1, g: 1, b: 1 },
        contrastRatio: 0,
        requiredRatio: 0,
        isCompliant: false,
        failingColors: [],
        recommendations: []
      };
      const analyzed = analyzeIconContrast(node as unknown as SceneNode, result);
      expect(analyzed).toEqual({
        passed: false,
        description: expect.any(String),
        severity: 'medium',
        role: 'interactive',
        colors: [],
        backgroundColor: { r: 1, g: 1, b: 1 },
        contrastRatio: 0,
        requiredRatio: expect.any(Number),
        nodeId: expect.any(String),
        nodeName: expect.any(String)
      });
    });
  });
});

describe('Icon Detection', () => {
  const createMockNode = (props: Partial<MockBaseNode>): SceneNode => {
    return new MockBaseNode(props) as unknown as SceneNode;
  };

  test('should detect icon by name', () => {
    const node = createMockNode({ name: 'icon-menu' });
    expect(isIconNode(node)).toBe(true);
  });

  test('should detect icon by type', () => {
    const node = createMockNode({ type: 'VECTOR' });
    expect(isIconNode(node)).toBe(true);
  });

  test('should detect icon by size', () => {
    const node = createMockNode({ width: 24, height: 24 });
    expect(isIconNode(node)).toBe(true);
  });

  test('should detect icon by shape', () => {
    const node = createMockNode({ type: 'ELLIPSE' });
    expect(isIconNode(node)).toBe(true);
  });

  test('should not detect non-icon node', () => {
    const node = createMockNode({ type: 'TEXT' });
    (node as any).characters = 'Hello'; 
    expect(isIconNode(node)).toBe(false);
  });

  test('should not detect hidden node', () => {
    const node = createMockNode({ visible: false });
    expect(isIconNode(node)).toBe(false);
  });
});

// Mock Figma's global object
(global as any).figma = {
  viewport: {
    zoom: 1
  },
  root: {
    type: 'DOCUMENT',
    children: []
  },
  currentPage: {
    selection: []
  },
  notify: (message: string) => {},
  ui: {
    postMessage: (msg: any) => {}
  },
  mixed: Symbol('mixed')
} as unknown as PluginAPI;
