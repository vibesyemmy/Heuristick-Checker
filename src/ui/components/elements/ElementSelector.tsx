import * as React from 'react';
import { theme } from '../../styles/theme';

interface SelectedElement {
  id: string;
  name: string;
  type: string;
}

interface ElementSelectorProps {
  selectedElements: SelectedElement[];
  onStartSelection: () => void;
  onClearSelection: () => void;
}

export const ElementSelector: React.FC<ElementSelectorProps> = ({
  selectedElements,
  onStartSelection,
  onClearSelection
}) => {
  return (
    <div style={{
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.medium,
      overflow: 'hidden'
    }}>
      <div style={{
        padding: theme.spacing.sm,
        background: theme.colors.border,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: theme.typography.sizes.heading,
          fontWeight: 500
        }}>Selected Elements</h3>
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <button
            onClick={onStartSelection}
            style={{
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              background: theme.colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: theme.borderRadius.small,
              cursor: 'pointer',
              fontSize: theme.typography.sizes.small
            }}
          >
            Select Elements
          </button>
          {selectedElements.length > 0 && (
            <button
              onClick={onClearSelection}
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                background: 'transparent',
                color: theme.colors.danger,
                border: `1px solid ${theme.colors.danger}`,
                borderRadius: theme.borderRadius.small,
                cursor: 'pointer',
                fontSize: theme.typography.sizes.small
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: theme.spacing.sm }}>
        {selectedElements.length === 0 ? (
          <p style={{
            margin: 0,
            fontSize: theme.typography.sizes.small,
            color: 'var(--figma-color-text-secondary)',
            textAlign: 'center',
            padding: theme.spacing.md
          }}>
            No elements selected. Click "Select Elements" to begin.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
            {selectedElements.map(element => (
              <div
                key={element.id}
                style={{
                  padding: theme.spacing.sm,
                  background: 'var(--figma-color-bg-secondary)',
                  borderRadius: theme.borderRadius.small,
                  fontSize: theme.typography.sizes.small
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontWeight: 500 }}>{element.name}</span>
                  <span style={{
                    color: 'var(--figma-color-text-secondary)',
                    fontSize: theme.typography.sizes.small
                  }}>
                    {element.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
