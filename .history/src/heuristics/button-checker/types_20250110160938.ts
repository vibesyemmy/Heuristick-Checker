export type TextCase = 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS';
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
