import * as React from 'react';
import { theme } from '../../styles/theme';

export type Severity = 'low' | 'medium' | 'high';

export interface HeuristicResult {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: Severity;
  recommendations?: string[];
}

interface ResultsProps {
  results: HeuristicResult[];
  onExport?: () => void;
  message?: string;
}

export const Results: React.FC<ResultsProps> = ({
  results,
  onExport,
  message
}) => {
  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case 'low':
        return theme.colors.info;
      case 'medium':
        return theme.colors.warning;
      case 'high':
        return theme.colors.danger;
    }
  };

  const getSeverityLabel = (severity: Severity) => {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  // If we have a message but no results, show the success message
  if (message && results.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
        height: '100%',
        textAlign: 'center',
        color: theme.colors.success
      }}>
        <p style={{ 
          margin: 0, 
          fontSize: theme.typography.sizes.body,
          lineHeight: '1.5'
        }}>
          {message}
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing.md,
      height: '100%',
      overflow: 'auto'
    }}>
      {results.length === 0 ? (
        <div style={{
          padding: theme.spacing.xl,
          textAlign: 'center',
          color: 'var(--figma-color-text-secondary)'
        }}>
          <p style={{ margin: 0, fontSize: theme.typography.sizes.body }}>
            Select an element and click "Scan Element" to begin the heuristic analysis.
          </p>
        </div>
      ) : (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: theme.typography.sizes.heading,
              fontWeight: 500
            }}>Analysis Results</h3>
            {onExport && (
              <button
                onClick={onExport}
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
                Export Results
              </button>
            )}
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.md
          }}>
            {results.map(result => (
              <div
                key={result.id}
                style={{
                  padding: theme.spacing.md,
                  background: 'var(--figma-color-bg-secondary)',
                  borderRadius: theme.borderRadius.medium,
                  borderLeft: `4px solid ${getSeverityColor(result.severity)}`
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: theme.spacing.xs
                }}>
                  <div>
                    <h4 style={{
                      margin: 0,
                      fontSize: theme.typography.sizes.body,
                      fontWeight: 500
                    }}>{result.title}</h4>
                    <p style={{
                      margin: `${theme.spacing.xs} 0 0 0`,
                      fontSize: theme.typography.sizes.small,
                      color: 'var(--figma-color-text-secondary)'
                    }}>{result.category}</p>
                  </div>
                  <span style={{
                    fontSize: theme.typography.sizes.small,
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                    background: `${getSeverityColor(result.severity)}20`,
                    color: getSeverityColor(result.severity),
                    borderRadius: theme.borderRadius.small,
                    fontWeight: 500
                  }}>
                    {getSeverityLabel(result.severity)}
                  </span>
                </div>

                <p style={{
                  margin: `${theme.spacing.sm} 0`,
                  fontSize: theme.typography.sizes.body
                }}>{result.description}</p>

                {result.recommendations && result.recommendations.length > 0 && (
                  <div style={{
                    marginTop: theme.spacing.sm
                  }}>
                    <h5 style={{
                      margin: 0,
                      fontSize: theme.typography.sizes.small,
                      fontWeight: 500,
                      color: 'var(--figma-color-text-secondary)'
                    }}>Recommendations:</h5>
                    <ul style={{
                      margin: `${theme.spacing.xs} 0 0 0`,
                      paddingLeft: theme.spacing.lg,
                      fontSize: theme.typography.sizes.small
                    }}>
                      {result.recommendations.map((rec, index) => (
                        <li key={index} style={{ marginBottom: theme.spacing.xs }}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
