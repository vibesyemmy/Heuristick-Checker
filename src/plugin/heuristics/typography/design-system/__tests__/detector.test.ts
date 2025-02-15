import { DesignSystemDetector } from '../detector';
import { DesignSystemInfo, TypographyToken } from '../types';

describe('DesignSystemDetector', () => {
  let mockDocument: any;
  let detector: DesignSystemDetector;

  beforeEach(() => {
    // Mock document with some text styles
    mockDocument = {
      id: 'test-doc',
      children: [
        {
          name: 'Design System',
          type: 'PAGE',
          children: []
        }
      ],
      getTextStyles: () => ([
        {
          name: 'Heading/H1/Desktop',
          fontSize: 32,
          lineHeight: { value: 40, unit: 'PIXELS' },
          fontName: { family: 'Inter', style: 'Regular' }
        },
        {
          name: 'Body/Regular/Mobile',
          fontSize: 16,
          lineHeight: { value: 24, unit: 'PIXELS' },
          fontName: { family: 'Inter', style: 'Regular' }
        }
      ])
    };

    detector = new DesignSystemDetector(mockDocument);
  });

  describe('detect()', () => {
    it('should detect local design system', async () => {
      const result = await detector.detect();
      
      expect(result).toBeTruthy();
      expect(result?.source.type).toBe('local');
      expect(result?.tokens.typography).toBeTruthy();
    });

    it('should cache detection results', async () => {
      const firstResult = await detector.detect();
      const secondResult = await detector.detect();
      
      expect(firstResult).toBe(secondResult);
    });

    it('should detect text styles with breakpoints', async () => {
      const result = await detector.detect();
      const tokens = result?.tokens.typography;

      expect(tokens).toBeTruthy();
      expect(Object.keys(tokens || {})).toHaveLength(2);

      const heading = Object.values(tokens || {}).find(t => t.role === 'heading');
      expect(heading).toBeTruthy();
      expect(heading?.breakpoints.desktop).toBeTruthy();
      expect(heading?.breakpoints.desktop.fontSize.min).toBe(32);
      expect(heading?.breakpoints.desktop.fontSize.max).toBe(32);
    });
  });

  describe('detectLocalSystem()', () => {
    it('should extract tokens from text styles', async () => {
      const result = await detector['detectLocalSystem']();
      
      expect(result).toBeTruthy();
      expect(result?.tokens.typography).toBeTruthy();
      expect(result?.confidence).toBeGreaterThan(0);
    });

    it('should handle missing text styles', async () => {
      mockDocument.getTextStyles = () => [];
      const result = await detector['detectLocalSystem']();
      
      expect(result).toBeNull();
    });
  });

  describe('detectLinkedSystems()', () => {
    beforeEach(() => {
      (global as any).figma = {
        getLinkedLibraries: () => ([
          {
            name: 'Design System Library',
            key: 'design-system-key'
          }
        ])
      };
    });

    it('should detect linked design system files', async () => {
      const results = await detector['detectLinkedSystems']();
      
      expect(results).toHaveLength(1);
      expect(results[0].source.type).toBe('external');
      expect(results[0].source.fileKey).toBe('design-system-key');
    });

    it('should handle errors in linked files', async () => {
      (global as any).figma.getLinkedLibraries = () => {
        throw new Error('Failed to get libraries');
      };

      const results = await detector['detectLinkedSystems']();
      expect(results).toHaveLength(0);
    });
  });
});
