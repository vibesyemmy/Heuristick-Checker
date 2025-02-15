import { TokenExtractor } from '../extractor';
import { DesignSystemTokens } from '../types';

describe('TokenExtractor', () => {
  let extractor: TokenExtractor;
  let mockStyles: any[];

  beforeEach(() => {
    extractor = new TokenExtractor();
    mockStyles = [
      {
        name: 'Heading/H1/Desktop',
        fontSize: 32,
        lineHeight: { value: 40, unit: 'PIXELS' },
        fontName: { family: 'Inter', style: 'Regular' },
        letterSpacing: { value: -0.5, unit: 'PIXELS' }
      },
      {
        name: 'Body/Regular/Mobile',
        fontSize: 16,
        lineHeight: { value: 24, unit: 'PIXELS' },
        fontName: { family: 'Inter', style: 'Regular' },
        letterSpacing: { value: 0, unit: 'PIXELS' }
      }
    ];
  });

  describe('extractFromTextStyles()', () => {
    it('should extract typography tokens from text styles', async () => {
      const result = await extractor.extractFromTextStyles(mockStyles);
      
      expect(result).toBeTruthy();
      expect(result.typography).toBeTruthy();
      expect(Object.keys(result.typography)).toHaveLength(2);
    });

    it('should detect breakpoints from style names', async () => {
      const result = await extractor.extractFromTextStyles(mockStyles);
      
      expect(result.breakpoints).toBeTruthy();
      expect(result.breakpoints.desktop).toBeTruthy();
      expect(result.breakpoints.mobile).toBeTruthy();
    });

    it('should parse text roles correctly', async () => {
      const result = await extractor.extractFromTextStyles(mockStyles);
      const tokens = Object.values(result.typography);

      const heading = tokens.find(t => t.role === 'heading');
      const body = tokens.find(t => t.role === 'body');

      expect(heading).toBeTruthy();
      expect(body).toBeTruthy();
    });

    it('should handle missing line height', async () => {
      const stylesWithoutLineHeight = mockStyles.map(style => ({
        ...style,
        lineHeight: undefined
      }));

      const result = await extractor.extractFromTextStyles(stylesWithoutLineHeight);
      const token = Object.values(result.typography)[0];

      expect(token.breakpoints.default.lineHeight).toEqual({
        min: 1.2,
        max: 1.5
      });
    });

    it('should detect variants from style names', async () => {
      mockStyles.push({
        name: 'Body/Regular/Bold',
        fontSize: 16,
        lineHeight: { value: 24, unit: 'PIXELS' },
        fontName: { family: 'Inter', style: 'Bold' }
      });

      const result = await extractor.extractFromTextStyles(mockStyles);
      const bodyToken = Object.values(result.typography)
        .find(t => t.role === 'body');

      expect(bodyToken?.variants).toBeTruthy();
      expect(bodyToken?.variants?.bold).toBeTruthy();
    });
  });

  describe('parseLineHeight()', () => {
    it('should handle pixel values', () => {
      const result = extractor['parseLineHeight']({
        value: 24,
        unit: 'PIXELS'
      });

      expect(result.min).toBe(22.8); // 24 * 0.95
      expect(result.max).toBe(25.2); // 24 * 1.05
    });

    it('should handle percentage values', () => {
      const result = extractor['parseLineHeight']({
        value: 150,
        unit: 'PERCENT'
      });

      expect(result.min).toBe(142.5); // 150 * 0.95
      expect(result.max).toBe(157.5); // 150 * 1.05
    });

    it('should use default range for AUTO', () => {
      const result = extractor['parseLineHeight']({
        unit: 'AUTO'
      });

      expect(result.min).toBe(1.2);
      expect(result.max).toBe(1.5);
    });
  });
});
