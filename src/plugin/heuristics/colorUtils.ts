import { FigmaColor } from './types';

// Convert sRGB to linear RGB
function toLinear(value: number): number {
  // Ensure value is a number and clamp between 0 and 1
  value = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 1;
  
  if (value <= 0.03928) {
    return value / 12.92;
  }
  return Math.pow((value + 0.055) / 1.055, 2.4);
}

// Convert linear RGB to sRGB
function fromLinear(value: number): number {
  // Ensure value is a number and clamp between 0 and 1
  value = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 1;
  
  if (value <= 0.00304) {
    return value * 12.92;
  }
  return 1.055 * Math.pow(value, 1/2.4) - 0.055;
}

// Calculate relative luminance
function calculateRelativeLuminance(color: FigmaColor): number {
  // Convert to linear RGB first
  const r = toLinear(color.r);
  const g = toLinear(color.g);
  const b = toLinear(color.b);
  
  // Calculate luminance using standard coefficients
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Blend colors in linear RGB space
export function blendWithBackground(foreground: FigmaColor, background: FigmaColor, opacity: number): FigmaColor {
  // Ensure opacity is a number and clamp between 0 and 1
  opacity = typeof opacity === 'number' ? Math.max(0, Math.min(1, opacity)) : 1;

  // Debug log
  console.log('Blending colors:', {
    foreground,
    background,
    opacity
  });

  // Convert to linear RGB
  const fr = toLinear(foreground.r);
  const fg = toLinear(foreground.g);
  const fb = toLinear(foreground.b);
  
  const br = toLinear(background.r);
  const bg = toLinear(background.g);
  const bb = toLinear(background.b);

  // Blend in linear space
  const r = fr * opacity + br * (1 - opacity);
  const g = fg * opacity + bg * (1 - opacity);
  const b = fb * opacity + bb * (1 - opacity);

  // Convert back to sRGB
  const result = {
    r: fromLinear(r),
    g: fromLinear(g),
    b: fromLinear(b),
    a: 1 // Always return fully opaque color after blending
  };

  // Debug log
  console.log('Blend result:', result);

  return result;
}

// Calculate contrast ratio between two colors
export function calculateContrastRatio(color1: FigmaColor, color2: FigmaColor): number {
  // Get luminance values
  const l1 = calculateRelativeLuminance(color1);
  const l2 = calculateRelativeLuminance(color2);
  
  // Calculate contrast ratio
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  
  // Debug log
  console.log('Contrast calculation:', {
    color1,
    color2,
    l1,
    l2,
    ratio
  });
  
  return ratio;
}

// Convert Figma color to hex string
export function colorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  const a = color.a !== undefined ? Math.round(color.a * 255).toString(16).padStart(2, '0') : 'ff';
  return `#${r}${g}${b}${a}`;
}
