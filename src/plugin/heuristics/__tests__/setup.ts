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
  }
};

// Mock console methods for cleaner test output
(global as any).console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Add a dummy test to prevent the "no tests" warning
describe('Test Setup', () => {
  test('should mock Figma globals', () => {
    expect(figma).toBeDefined();
    expect(figma.viewport).toBeDefined();
    expect(figma.root).toBeDefined();
    expect(figma.currentPage).toBeDefined();
  });
});
