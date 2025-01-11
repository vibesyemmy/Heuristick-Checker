import { __testing } from '../iconContrast';
const { isIconNode, determineIconRole, findEffectiveBackground, calculateContrastRatio } = __testing;

// Types and interfaces
type IconRole = 'interactive' | 'informative' | 'decorative';

interface MockBaseNode {
  id: string;
  name: string;
  type: NodeType;
  parent: MockBaseNode | null;
  visible: boolean;
  locked: boolean;
  removed: false;
  children: MockBaseNode[];
  constraints: { horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE', vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE' };
  relativeTransform: number[][];
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  fills?: Paint[];
  opacity: number;
  blendMode: BlendMode;
  effects: Effect[];
  effectStyleId: string;
  strokeWeight: number;
  strokeAlign: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  strokes: Paint[];
  clone: () => MockBaseNode;
  // Add Figma node methods
  setRelaunchData: () => void;
  getPluginData: () => string;
  setPluginData: () => void;
  getSharedPluginData: () => string;
  setSharedPluginData: () => void;
  remove: () => void;
  toString: () => string;
  // Add additional Figma node properties
  absoluteTransform: number[][];
  cornerRadius: number | PluginAPI['mixed'];
  exportSettings: ExportSettings[];
  constrainProportions: boolean;
  layoutAlign: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'INHERIT';
  layoutGrow: number;
  primaryAxisSizingMode: 'FIXED' | 'AUTO';
  counterAxisSizingMode: 'FIXED' | 'AUTO';
  primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX';
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  itemSpacing: number;
  layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  backgrounds: Paint[];
  backgroundStyleId: string;
  clipsContent: boolean;
  guides: Guide[];
  gridStyleId: string;
  selection: SceneNode[];
  selectedTextRange: { node: TextNode; start: number; end: number } | null;
  currentPage: PageNode;
  triggeredBy: { origin: 'LOCAL' | 'REMOTE' } | undefined;
  componentProperties: { [key: string]: any } | undefined;
  inferredAutoLayout: { [key: string]: any } | undefined;
  boundVariables: { [key: string]: any } | undefined;
  reactions: any[];
  remote: boolean;
  key: string;
  pluginData: { [key: string]: string };
  sharedPluginData: { [namespace: string]: { [key: string]: string } };
  componentPropertyDefinitions: { [property: string]: any };
}

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

const createMockNode = (props: Partial<MockBaseNode>): SceneNode => {
  const base: MockBaseNode = {
    id: '1',
    name: 'test',
    type: 'VECTOR',
    width: 24,
    height: 24,
    parent: null,
    visible: true,
    locked: false,
    removed: false,
    children: [],
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    relativeTransform: [[1, 0, 0], [0, 1, 0]],
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    blendMode: 'PASS_THROUGH',
    effects: [],
    effectStyleId: '',
    strokeWeight: 1,
    strokeAlign: 'INSIDE',
    strokes: [],
    fills: [],
    clone: () => ({ ...base, ...props }),
    setRelaunchData: () => {},
    getPluginData: () => '',
    setPluginData: () => {},
    getSharedPluginData: () => '',
    setSharedPluginData: () => {},
    remove: () => {},
    toString: () => '[Figma Node]',
    absoluteTransform: [[1, 0, 0], [0, 1, 0]],
    cornerRadius: 0,
    exportSettings: [],
    constrainProportions: false,
    layoutAlign: 'INHERIT',
    layoutGrow: 0,
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'FIXED',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    itemSpacing: 0,
    layoutMode: 'NONE',
    backgrounds: [],
    backgroundStyleId: '',
    clipsContent: false,
    guides: [],
    gridStyleId: '',
    selection: [],
    selectedTextRange: null,
    currentPage: null as any,
    triggeredBy: undefined,
    componentProperties: undefined,
    inferredAutoLayout: undefined,
    boundVariables: undefined,
    reactions: [],
    remote: false,
    key: '1',
    pluginData: {},
    sharedPluginData: {},
    componentPropertyDefinitions: {}
  };

  return { ...base, ...props } as unknown as SceneNode;
};

const defaultConfig = {
  maxSize: 48,
  namePatterns: ['icon', 'ico', 'info', 'i', 'delete', 'add', 'close', 'menu'],
  roleOverrides: new Map(),
  contrastThresholds: {
    interactive: 3,
    informative: 2.5,
    decorative: 1.5
  }
};

describe('Icon Detection', () => {
  test('should detect icon by name', () => {
    const iconNode = createMockNode({ name: 'icon' });
    const nonIconNode = createMockNode({ name: 'rectangle' });

    expect(__testing.isIconNode(iconNode as any, defaultConfig)).toBe(true);
    expect(__testing.isIconNode(nonIconNode as any, defaultConfig)).toBe(false);
  });

  test('should detect icon by size', () => {
    const smallNode = createMockNode({ width: 24, height: 24 });
    const largeNode = createMockNode({ width: 100, height: 100 });

    expect(__testing.isIconNode(smallNode as any, defaultConfig)).toBe(true);
    expect(__testing.isIconNode(largeNode as any, defaultConfig)).toBe(false);
  });

  test('should detect icon by type', () => {
    const vectorNode = createMockNode({ type: 'VECTOR' });
    const frameNode = createMockNode({ type: 'FRAME' });

    expect(__testing.isIconNode(vectorNode as any, defaultConfig)).toBe(true);
    expect(__testing.isIconNode(frameNode as any, defaultConfig)).toBe(false);
  });

  test('should detect icon by context', () => {
    const parentNode = createMockNode({ type: 'INSTANCE' });
    const buttonIcon = createMockNode({ parent: parentNode as any });

    expect(__testing.isIconNode(buttonIcon as any, defaultConfig)).toBe(true);
  });
});

describe('Icon Role Classification', () => {
  test('should classify interactive icons', () => {
    const parentNode = createMockNode({ type: 'INSTANCE' });
    const buttonIcon = createMockNode({
      parent: parentNode as any
    });

    expect(__testing.determineIconRole(buttonIcon as any, defaultConfig)).toBe('interactive');
  });

  test('should classify informative icons', () => {
    const parentNode = createMockNode({ type: 'FRAME' });
    const infoIcon = createMockNode({
      name: 'info-icon',
      parent: parentNode as any
    });

    expect(__testing.determineIconRole(infoIcon as any, defaultConfig)).toBe('informative');
  });

  test('should classify decorative icons', () => {
    const parentNode = createMockNode({ type: 'FRAME', name: 'background' });
    const decorativeIcon = createMockNode({
      name: 'decorative-icon',
      parent: parentNode as any
    });

    expect(__testing.determineIconRole(decorativeIcon as any, defaultConfig)).toBe('decorative');
  });
});

describe('Background Detection', () => {
  test('should find opaque background', () => {
    const node = createMockNode({
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }]
    });

    const background = __testing.findEffectiveBackground(node as any);
    expect(background).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  test('should find semi-transparent background', () => {
    const node = createMockNode({
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.5 }]
    });

    const background = __testing.findEffectiveBackground(node as any);
    expect(background).toEqual({ r: 1, g: 1, b: 1, a: 0.5 });
  });
});

describe('Contrast Calculation', () => {
  test('should calculate correct contrast ratio', () => {
    // White on black
    expect(calculateContrastRatio(
      { r: 1, g: 1, b: 1 },
      { r: 0, g: 0, b: 0 }
    )).toBeCloseTo(21);

    // Gray on white (50% gray, #808080)
    expect(calculateContrastRatio(
      { r: 0.5, g: 0.5, b: 0.5 },
      { r: 1, g: 1, b: 1 }
    )).toBeCloseTo(3.98);
  });

  test('should handle transparent colors', () => {
    expect(calculateContrastRatio(
      { r: 1, g: 1, b: 1, a: 0.5 },
      { r: 0, g: 0, b: 0 }
    )).toBeGreaterThan(0);
  });
});
