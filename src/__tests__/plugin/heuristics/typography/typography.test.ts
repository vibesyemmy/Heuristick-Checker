import { TypographyValidator } from '../../../../plugin/heuristics/typography/typography';
import { defaultTypographyConfig } from '../../../../plugin/heuristics/typography/config';
import { TextNodeWithStyle } from '../../../../plugin/heuristics/typography/shared';

// Mock Figma's API
const mockFigma = {
  mixed: Symbol('mixed'),
  viewport: {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 }
  },
  root: {
    type: 'DOCUMENT',
    children: []
  },
  currentPage: {
    type: 'PAGE',
    children: []
  }
};

(global as any).figma = {
  ...mockFigma,
  loadFontAsync: jest.fn().mockResolvedValue(undefined)
};

describe('Typography Validation', () => {
  let validator: TypographyValidator;

  // Create a test validator class that exposes protected methods
  class TestTypographyValidator extends TypographyValidator {
    public getRoleAnalyzer() { return this.roleAnalyzer; }
    public getMainFrameWidth(node: TextNodeWithStyle) { return super.getMainFrameWidth(node); }
    public getBreakpointKey(frameWidth: number) { return super.getBreakpointKey(frameWidth); }
  }

  beforeEach(() => {
    validator = new TestTypographyValidator(defaultTypographyConfig);
    // Reset Figma page children
    mockFigma.currentPage.children = [];

    // Mock role analyzer to detect roles based on node name
    const mockRoleAnalyzer = {
      analyzeRole: async (node: TextNodeWithStyle) => {
        const role = node.name.toLowerCase();
        const baseContext = {
          confidence: 1,
          frameWidth: 1512,
          breakpointKey: 'lg' as const,
          sizeCategory: 'large' as const,
          role: 'body' as const,
          hasAmbiguity: false
        };
        if (role.includes('heading') || role.includes('h1')) return { ...baseContext, role: 'heading' };
        if (role.includes('body')) return { ...baseContext, role: 'body' };
        if (role.includes('caption')) return { ...baseContext, role: 'caption' };
        if (role.includes('title')) return { ...baseContext, role: 'heading' };
        if (role.includes('button')) return { ...baseContext, role: 'button' };
        return { ...baseContext, role: 'body' }; // Default to body text
      }
    };
  });

  describe('Frame Width Detection', () => {
    test('should get width from outermost frame', () => {
      // Create a deep frame hierarchy
      const mainFrame = createFrame('MainFrame', 1512) as FrameNode;
      const content = createFrame('Content', 800);
      const header = createFrame('Header', 400);
      const title = createTextNode('Title', 'Hello World', 40);

      // Set up hierarchy
      mainFrame.appendChild(content);
      content.appendChild(header);
      header.appendChild(title);

      // Set up parent relationships
      content.parent = mainFrame;
      header.parent = content;
      title.parent = header;

      // Add to Figma page
      mockFigma.currentPage.children = [mainFrame];

      // Test width detection
      const width = validator.getMainFrameWidth(title);
      expect(width).toBe(1512);
    });

    test('should ignore component/instance frames', () => {
      // Create hierarchy with component frames
      const mainFrame = createFrame('MainFrame', 1512) as FrameNode;
      const component = createFrame('Component Instance', 400);
      const text = createTextNode('Text', 'Component Text', 16);

      // Set up hierarchy
      mainFrame.appendChild(component);
      component.appendChild(text);

      // Set up parent relationships
      component.parent = mainFrame;
      text.parent = component;

      // Add to Figma page
      mockFigma.currentPage.children = [mainFrame];

      // Test width detection
      const width = validator.getMainFrameWidth(text);
      expect(width).toBe(1512);
    });

    test('should handle text nodes at different depths', () => {
      const mainFrame = createFrame('MainFrame', 1512) as FrameNode;
      
      // Direct child
      const directText = createTextNode('DirectText', 'Direct Child', 16);
      mainFrame.appendChild(directText);
      directText.parent = mainFrame;
      
      // Nested child
      const group = createFrame('Group', 800);
      const nestedText = createTextNode('NestedText', 'Nested Child', 16);
      mainFrame.appendChild(group);
      group.appendChild(nestedText);
      group.parent = mainFrame;
      nestedText.parent = group;
      
      // Component child
      const component = createFrame('Component Instance', 400);
      const componentText = createTextNode('ComponentText', 'Component Child', 16);
      mainFrame.appendChild(component);
      component.appendChild(componentText);
      component.parent = mainFrame;
      componentText.parent = component;

      // Add to Figma page
      mockFigma.currentPage.children = [mainFrame];

      // Test all positions
      expect(validator.getMainFrameWidth(directText)).toBe(1512);
      expect(validator.getMainFrameWidth(nestedText)).toBe(1512);
      expect(validator.getMainFrameWidth(componentText)).toBe(1512);
    });
  });

  describe('Breakpoint Detection', () => {
    test('should map frame widths to correct breakpoints', () => {
      const testCases = [
        { width: 374, expected: 'xs' },  // < 375
        { width: 500, expected: 'sm' },  // 375-767
        { width: 900, expected: 'md' },  // 768-1023
        { width: 1200, expected: 'lg' }, // 1024-1439
        { width: 1500, expected: 'xl' }  // >= 1440
      ];

      testCases.forEach(({ width, expected }) => {
        const breakpoint = validator.getBreakpointKey(width);
        expect(breakpoint).toBe(expected);
      });
    });

    test('should handle edge cases', () => {
      // Test boundary conditions
      expect(validator.getBreakpointKey(0)).toBe('xs');
      expect(validator.getBreakpointKey(374)).toBe('xs');
      expect(validator.getBreakpointKey(375)).toBe('sm');
      expect(validator.getBreakpointKey(767)).toBe('sm');
      expect(validator.getBreakpointKey(768)).toBe('md');
      expect(validator.getBreakpointKey(1023)).toBe('md');
      expect(validator.getBreakpointKey(1024)).toBe('lg');
      expect(validator.getBreakpointKey(1439)).toBe('lg');
      expect(validator.getBreakpointKey(1440)).toBe('xl');
      expect(validator.getBreakpointKey(2000)).toBe('xl');
    });
  });

  describe('Rich Text Validation', () => {
    beforeEach(() => {
      // Mock rich text segments with complete style information
      const mockSegments = [
        {
          characters: 'Rich',
          fontSize: 16,
          fontName: { family: 'Inter', style: 'Regular' },
          lineHeight: { unit: 'PIXELS', value: 24 },
          letterSpacing: { unit: 'PIXELS', value: 0 },
          textStyleId: '',
          fillStyleId: '',
          listOptions: null,
          indentation: 0,
          textCase: 'ORIGINAL',
          textDecoration: 'NONE',
          textAlignHorizontal: 'LEFT',
          start: 0,
          end: 4
        },
        {
          characters: 'Text',
          fontSize: 24,
          fontName: { family: 'Inter', style: 'Bold' },
          lineHeight: { unit: 'PIXELS', value: 32 },
          letterSpacing: { unit: 'PIXELS', value: 0 },
          textStyleId: '',
          fillStyleId: '',
          listOptions: null,
          indentation: 0,
          textCase: 'ORIGINAL',
          textDecoration: 'NONE',
          textAlignHorizontal: 'LEFT',
          start: 4,
          end: 8
        }
      ];

      // Mock getStyledTextSegments to return valid segments
      const mockGetStyledTextSegments = jest.fn().mockReturnValue(mockSegments);

      // Extend createTextNode to include getStyledTextSegments
      const originalCreateTextNode = createTextNode;
      (global as any).createTextNode = (name: string, characters: string, fontSize: number) => {
        const node = originalCreateTextNode(name, characters, fontSize);
        node.getStyledTextSegments = mockGetStyledTextSegments;
        return node;
      };
      // All mocks are set up in the first beforeEach block
    });
    test('should handle mixed styles correctly', async () => {
      const node = createTextNode('mixed-styles', 'Rich Text', 16);
      node.textStyleId = mockFigma.mixed;
      node.fontSize = mockFigma.mixed;
      node.fontName = mockFigma.mixed;
      
      // Mock getStyledTextSegments to return segments with different styles
      node.getStyledTextSegments = jest.fn().mockReturnValue([
        {
          characters: 'Rich',
          fontName: { family: 'Inter', style: 'Regular' },
          fontSize: 16,
          lineHeight: { value: 19.2 },
          letterSpacing: { value: 0 }
        },
        {
          characters: 'Text',
          fontName: { family: 'Inter', style: 'Bold' },
          fontSize: 24,
          lineHeight: { value: 28.8 },
          letterSpacing: { value: 0 }
        }
      ]);
      
      const result = await validator.validate(node);
      
      expect(result.richTextAnalysis).toBeDefined();
      expect(result.richTextAnalysis?.segments).toHaveLength(2);
      expect(result.richTextAnalysis?.hasMultipleFonts).toBe(false);
      expect(result.richTextAnalysis?.hasMultipleSizes).toBe(true);
      expect(result.richTextAnalysis?.hasMultipleWeights).toBe(true);
      
      // Check first segment
      const firstSegment = result.richTextAnalysis?.segments[0];
      expect(firstSegment?.text).toBe('Rich');
      expect(firstSegment?.style.fontSize).toBe(16);
      expect(firstSegment?.style.fontWeight).toBe('Regular');
      
      // Check second segment
      const secondSegment = result.richTextAnalysis?.segments[1];
      expect(secondSegment?.text).toBe('Text');
      expect(secondSegment?.style.fontSize).toBe(24);
      expect(secondSegment?.style.fontWeight).toBe('Bold');
    });

    test('should handle text without mixed styles', async () => {
      const node = createTextNode('regular-text', 'Regular Text', 16);
      node.fontName = { family: 'Inter', style: 'Regular' };
      
      // Mock getStyledTextSegments to return a single segment
      node.getStyledTextSegments = jest.fn().mockReturnValue([
        {
          characters: 'Regular Text',
          fontName: { family: 'Inter', style: 'Regular' },
          fontSize: 16,
          lineHeight: { value: 19.2 },
          letterSpacing: { value: 0 }
        }
      ]);
      
      const result = await validator.validate(node);
      
      expect(result.richTextAnalysis).toBeDefined();
      expect(result.richTextAnalysis?.segments).toHaveLength(1);
      expect(result.richTextAnalysis?.hasMultipleFonts).toBe(false);
      expect(result.richTextAnalysis?.hasMultipleSizes).toBe(false);
      expect(result.richTextAnalysis?.hasMultipleWeights).toBe(false);
      
      const segment = result.richTextAnalysis?.segments[0];
      expect(segment?.text).toBe('Regular Text');
      expect(segment?.style.fontSize).toBe(16);
      expect(segment?.style.fontWeight).toBe('Regular');
    });

    test('should validate style consistency', async () => {
      const node = createTextNode('heading-text', 'Heading Text', 24);
      node.textStyleId = mockFigma.mixed;
      node.fontSize = mockFigma.mixed;
      node.fontName = mockFigma.mixed;
      
      // Mock getStyledTextSegments to return segments with inconsistent weights
      node.getStyledTextSegments = jest.fn().mockReturnValue([
        {
          characters: 'Heading',
          fontName: { family: 'Inter', style: 'Bold' },
          fontSize: 24,
          lineHeight: { value: 28.8 },
          letterSpacing: { value: 0 }
        },
        {
          characters: ' Text',
          fontName: { family: 'Inter', style: 'Regular' },
          fontSize: 24,
          lineHeight: { value: 28.8 },
          letterSpacing: { value: 0 }
        }
      ]);
      
      // Mock role analyzer to identify this as a heading
      const mockRoleAnalyzer = validator.getRoleAnalyzer();
      mockRoleAnalyzer.analyzeRole = jest.fn().mockResolvedValue({
        role: 'heading',
        confidence: 1,
        frameWidth: 1512,
        breakpointKey: 'lg',
        sizeCategory: 'large',
        hasAmbiguity: false
      });
      
      // Mock the role analyzer to return a heading role
      const mockAnalyzeRole = jest.fn().mockResolvedValue({
        role: 'heading',
        confidence: 1,
        frameWidth: 1512,
        breakpointKey: 'lg' as const,
        sizeCategory: 'large' as const,
        hasAmbiguity: false
      });
      validator.getRoleAnalyzer().analyzeRole = mockAnalyzeRole;
      
      const result = await validator.validate(node);
      
      // For headings, we expect consistent font weight
      expect(result.issues).toContainEqual(expect.objectContaining({
        type: 'Mixed Styles',
        code: 'INCONSISTENT_FONT_WEIGHT',
        severity: 'warning'
      }));
    });

    test('should validate each segment of rich text', async () => {
      const node = createTextNode('rich-text', 'Rich Text', 16);
      node.getStyledTextSegments = jest.fn().mockReturnValue([
        { characters: 'Rich', fontSize: 16, fontName: { family: 'Inter', style: 'Regular' } },
        { characters: 'Text', fontSize: 24, fontName: { family: 'Inter', style: 'Bold' } }
      ]);
      
      const result = await validator.validate(node);
      expect(result.issues).toHaveLength(0);
      expect(result.richTextAnalysis?.segments).toHaveLength(2);
    });
  });

  describe('Font Loading', () => {
    beforeEach(() => {
      // Setup font loading mock
      (global as any).figma.loadFontAsync = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });
    beforeEach(() => {
      // Mock figma.loadFontAsync
      (global as any).figma.loadFontAsync = jest.fn().mockResolvedValue(undefined);
    });
    test('should cache loaded fonts', async () => {
      const node = createTextNode('font-test', 'Test Text', 16);
      node.fontName = { family: 'Inter', style: 'Regular' };
      
      await validator.validate(node);
      await validator.validate(node); // Second validation
      
      // Font should only be loaded once
      expect(figma.loadFontAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Breakpoint Detection', () => {
    beforeAll(() => {
      // Mock figma.loadFontAsync
      (global as any).figma = {
        ...mockFigma,
        loadFontAsync: jest.fn().mockResolvedValue(undefined)
      };
    });

    test('should handle small (sm) breakpoint', async () => {
      const frame = createFrame('small-frame', 500);  // Between 375 and 768
      const text = createTextNode('mobile-text', 'Mobile', 16);
      frame.appendChild(text);
      text.parent = frame;
      
      const result = await validator.validate(text);
      expect(result.context.breakpointKey).toBe('sm');
    });

    test('should handle medium (md) breakpoint', async () => {
      const frame = createFrame('medium-frame', 900);  // Between 768 and 1024
      const text = createTextNode('tablet-text', 'Tablet', 16);
      frame.appendChild(text);
      text.parent = frame;
      
      const result = await validator.validate(text);
      expect(result.context.breakpointKey).toBe('md');
    });
  });

  describe('Style Requirements', () => {
    test('should get correct font size range for breakpoint', async () => {
      const mainFrame = createFrame('MainFrame', 1512) as FrameNode;
      const title = createTextNode('Title', 'Large Title', 32); // Use valid size
      mainFrame.appendChild(title);
      title.parent = mainFrame;

      // Add to Figma page
      mockFigma.currentPage.children = [mainFrame];

      const result = await validator.validate(title);
      expect(result.context.frameWidth).toBe(1512);
      expect(result.issues).toHaveLength(0);
    });

    test('should handle different text roles', async () => {
      const mainFrame = createFrame('MainFrame', 1512) as FrameNode;
      
      // Heading
      const heading = createTextNode('Heading', 'Large Heading', 40); // Use valid size for h1
      mainFrame.appendChild(heading);
      heading.parent = mainFrame;
      
      // Body
      const body = createTextNode('Body', 'Body Text', 16);
      body.name = 'body-text'; // Set name to indicate role
      body.fontName = { family: 'Inter', style: 'Medium' };
      body.lineHeight = { unit: 'PIXELS', value: 24 };
      body.textAlignHorizontal = 'LEFT';
      mainFrame.appendChild(body);
      body.parent = mainFrame;
      
      // Caption
      const caption = createTextNode('Caption', 'Small Caption', 12);
      mainFrame.appendChild(caption);
      caption.parent = mainFrame;

      // Add to Figma page
      mockFigma.currentPage.children = [mainFrame];

      const headingResult = await validator.validate(heading);
      const bodyResult = await validator.validate(body);
      const captionResult = await validator.validate(caption);

      expect(headingResult.context.frameWidth).toBe(1512);
      expect(bodyResult.context.frameWidth).toBe(1512);
      expect(captionResult.context.frameWidth).toBe(1512);

      expect(headingResult.issues).toHaveLength(0);
      expect(bodyResult.issues).toHaveLength(0);
      expect(captionResult.issues).toHaveLength(0);
    });
  });

  describe('Typography Validation', () => {
    test('should validate typography based on main frame', async () => {
      // Create deep hierarchy
      const mainFrame = createFrame('MainFrame', 1512) as FrameNode;
      const content = createFrame('Content', 800);
      const header = createFrame('Header', 400);
      const title = createTextNode('title-text', 'Hello World', 28); // Use valid size for title
      title.fontName = { family: 'Inter', style: 'Semi Bold' };

      // Set up hierarchy
      mainFrame.appendChild(content);
      content.appendChild(header);
      header.appendChild(title);

      // Set up parent relationships
      content.parent = mainFrame;
      header.parent = content;
      title.parent = header;

      // Add to Figma page
      mockFigma.currentPage.children = [mainFrame];

      const result = await validator.validate(title);
      
      // Should use main frame width for validation
      expect(result.context.frameWidth).toBe(1512);
      expect(result.issues).toHaveLength(0);
    });

    test('should handle responsive typography', async () => {
      const testCases = [
        { width: 1512, name: 'Desktop' },
        { width: 768, name: 'Tablet' },
        { width: 375, name: 'Mobile' }
      ];

      for (const { width, name } of testCases) {
        const frame = createFrame(name, width);
        const text = createTextNode('Text', 'Responsive Text', 16);
        frame.appendChild(text);
        text.parent = frame;

        // Add to Figma page
        mockFigma.currentPage.children = [frame];

        const result = await validator.validate(text);
        expect(result.context.frameWidth).toBe(width);
      }
    });
  });
});

// Helper functions to create mock nodes
function createFrame(name: string, width: number): FrameNode {
  return {
    name,
    type: 'FRAME',
    width,
    appendChild: jest.fn(),
    parent: null,
    children: []
  } as unknown as FrameNode;
}

function createTextNode(name: string, characters: string, fontSize: number): TextNodeWithStyle {
  const node = {
    name,
    type: 'TEXT',
    characters,
    fontSize,
    _parent: null,
    fontName: {
      family: 'Inter',
      style: 'Semi Bold'
    },
    lineHeight: {
      value: fontSize * 1.2,
      unit: 'PIXELS'
    },
    letterSpacing: {
      value: 0,
      unit: 'PIXELS'
    },
    textAlignHorizontal: 'LEFT',
    getStyledTextSegments: () => [{
      characters,
      start: 0,
      end: characters.length,
      fontSize,
      fontName: {
        family: 'Inter',
        style: 'Semi Bold'
      },
      lineHeight: {
        value: fontSize * 1.2,
        unit: 'PIXELS'
      },
      letterSpacing: {
        value: 0,
        unit: 'PIXELS'
      }
    }]
  };

  Object.defineProperty(node, 'parent', {
    get() { return this._parent; },
    set(value) { this._parent = value; }
  });

  return node as unknown as TextNodeWithStyle;
}
