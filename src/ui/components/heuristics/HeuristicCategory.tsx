import * as React from 'react';
import { theme } from '../../styles/theme';

export interface HeuristicItem {
  id: string;
  title: string;
  description: string;
  status?: 'passed' | 'failed' | 'warning' | 'not-checked';
}

interface HeuristicCategoryProps {
  title: string;
  items: HeuristicItem[];
  onSelect: (itemId: string) => void;
}

export const HeuristicCategory: React.FC<HeuristicCategoryProps> = ({
  title,
  items,
  onSelect
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
        borderBottom: `1px solid ${theme.colors.border}`
      }}>
        <h3 style={{
          margin: 0,
          fontSize: theme.typography.sizes.heading,
          fontWeight: 500
        }}>{title}</h3>
      </div>
      <div style={{ padding: theme.spacing.sm }}>
        {items.map(item => (
          <div
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              padding: theme.spacing.sm,
              marginBottom: theme.spacing.xs,
              cursor: 'pointer',
              borderRadius: theme.borderRadius.small,
              background: 'var(--figma-color-bg-secondary)',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm
            }}>
              <StatusIndicator status={item.status} />
              <span style={{
                fontSize: theme.typography.sizes.body,
                fontWeight: 500
              }}>{item.title}</span>
            </div>
            <p style={{
              margin: `${theme.spacing.xs} 0 0`,
              fontSize: theme.typography.sizes.small,
              color: 'var(--figma-color-text-secondary)'
            }}>{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatusIndicator: React.FC<{ status?: HeuristicItem['status'] }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'passed':
        return theme.colors.success;
      case 'failed':
        return theme.colors.danger;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.border;
    }
  };

  return (
    <div style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: getStatusColor()
    }} />
  );
};
