export type TextCase = 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS';
export type TextDecoration = 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}

export interface Paint {
  type: string;
  color?: RGB;
  opacity?: number;
  blendMode?: string;
  visible?: boolean;
}

export interface Effect {
  type: string;
  visible?: boolean;
  radius?: number;
  spread?: number;
  color?: RGBA;
  offset?: { x: number; y: number };
  blendMode?: string;
}

export interface ButtonText {
  fontSize?: number;
  fontWeight?: number;
  textCase?: TextCase;
  textDecoration?: TextDecoration;
}

export interface ButtonStyle {
  fills: Paint[];
  strokes: Paint[];
  effects: Effect[];
  cornerRadius: number | number[];
}

export interface ButtonSize {
  width: number;
  height: number;
  padding: number | { top: number; right: number; bottom: number; left: number };
}

export interface ButtonStates {
  hasHoverState: boolean;
  hasPressedState: boolean;
  hasDisabledState: boolean;
}

export interface ButtonProperties {
  id: string;
  name: string;
  text?: ButtonText;
  style: ButtonStyle;
  size: ButtonSize;
  states: ButtonStates;
}

export interface ButtonDetectionResult {
  node: any;
  properties: ButtonProperties;
}

export interface StyleIssue {
  id: string;
  type: 'style' | 'pattern';
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedNodes: string[];
  details?: {
    expected: any;
    actual: any;
  };
}
