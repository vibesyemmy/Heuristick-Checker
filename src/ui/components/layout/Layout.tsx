import * as React from 'react';
import { theme } from '../../styles/theme';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      padding: theme.spacing.md,
      gap: theme.spacing.md,
      background: theme.colors.background,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily
    }}>
      {children}
    </div>
  );
};
