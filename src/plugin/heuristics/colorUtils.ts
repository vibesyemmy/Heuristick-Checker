import { FigmaColor } from './types';

// Convert sRGB to linear RGB
function toLinear(value: number): number {
  // Ensure value is a number and clamp between 0 and 1
  value = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 1;
  
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return Math.pow((value + 0.055) / 1.055, 2.4);
}

// Convert linear RGB to sRGB
function fromLinear(value: number): number {
  // Ensure value is a number and clamp between 0 and 1
  value = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 1;
  
  if (value <= 0.0031308) {
    return value * 12.92;
  }
  return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
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

/**
 * Blends colors in linear RGB space to account for gamma correction
 * @param foreground - sRGB color with optional alpha
 * @param background - sRGB background color
 * @param opacity - Blend opacity (0-1)
 * @returns Blended sRGB color with combined opacity
 */
export function blendWithBackground(foreground: FigmaColor, background: FigmaColor, opacity: number): FigmaColor {
  // Ensure opacity is between 0 and 1
  opacity = Math.max(0, Math.min(1, opacity));

  // If opacity is 0, return background color
  if (opacity === 0) {
    return { ...background };
  }

  // If opacity is 1, return foreground color
  if (opacity === 1) {
    return { ...foreground };
  }

  // Convert to linear RGB for blending
  const fgLinear = {
    r: toLinear(foreground.r),
    g: toLinear(foreground.g),
    b: toLinear(foreground.b)
  };

  const bgLinear = {
    r: toLinear(background.r),
    g: toLinear(background.g),
    b: toLinear(background.b)
  };

  // For each channel, blend in linear space:
  // C = α × Fg + (1-α) × Bg
  // where α is the opacity, Fg is foreground color, Bg is background color
  const blended = {
    r: fromLinear((fgLinear.r * opacity) + (bgLinear.r * (1 - opacity))),
    g: fromLinear((fgLinear.g * opacity) + (bgLinear.g * (1 - opacity))),
    b: fromLinear((fgLinear.b * opacity) + (bgLinear.b * (1 - opacity)))
  };

  return blended;
}

// Calculate contrast ratio between two colors
export function calculateContrastRatio(color1: FigmaColor, color2: FigmaColor): number {
  // Get luminance values
  const l1 = calculateRelativeLuminance(color1);
  const l2 = calculateRelativeLuminance(color2);
  
  // Calculate contrast ratio
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  // Calculate ratio with standard formula
  const ratio = (lighter + 0.05) / (darker + 0.05);
  
  // Round to 2 decimal places for consistency
  return Math.round(ratio * 100) / 100;
}

// Convert Figma color to hex string
export function colorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  const a = color.a !== undefined ? Math.round(color.a * 255).toString(16).padStart(2, '0') : 'ff';
  return `#${r}${g}${b}${a}`;
}
