import * as React from 'react';
import { theme } from '../../styles/theme';
import folderImage from '../../img/folder.png';

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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing.md,
      height: '100%',
      overflow: 'auto'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <p style={{
          margin: 0,
          fontSize: '14px',
          color: '#FFFFFF'
        }}>
          Analysis results will show here
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: results.length === 0 ? 'center' : 'stretch',
          justifyContent: results.length === 0 ? 'center' : 'flex-start',
          background: theme.colors.backgroundSecondary,
          padding: theme.spacing.xl,
          borderRadius: theme.borderRadius.large,
          height: '462px',
          width: '100%',
          overflow: 'auto'
        }}>
          {results.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              textAlign: 'center'
            }}>
              <img 
                src={folderImage} 
                alt="Empty state folder"
                style={{ width: '160px', height: '160px' }}
              />
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.32)',
                  lineHeight: '20px'
                }}>
                  Choose an element and hit 'Scan Element' to start your heuristic analysis.
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.md,
              width: '100%'
            }}>
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
                gap: theme.spacing.md,
                background: theme.colors.background,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.large
              }}>
                {results.map(result => (
                  <div
                    key={result.id}
                    style={{
                      padding: theme.spacing.md,
                      background: theme.colors.background,
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
                          fontWeight: theme.typography.weights.medium
                        }}>{result.title}</h4>
                        <p style={{
                          margin: `${theme.spacing.xs} 0 0 0`,
                          fontSize: theme.typography.sizes.small,
                          color: theme.colors.textSecondary
                        }}>{result.category}</p>
                      </div>
                      <span style={{
                        fontSize: theme.typography.sizes.small,
                        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                        background: `${getSeverityColor(result.severity)}20`,
                        color: getSeverityColor(result.severity),
                        borderRadius: theme.borderRadius.small,
                        fontWeight: theme.typography.weights.medium
                      }}>
                        {getSeverityLabel(result.severity)}
                      </span>
                    </div>

                    <p style={{
                      margin: `${theme.spacing.sm} 0`,
                      fontSize: theme.typography.sizes.small,
                      color: theme.colors.text,
                      lineHeight: '16px'
                    }}>{result.description}</p>

                    {result.recommendations && result.recommendations.length > 0 && (
                      <div style={{
                        marginTop: theme.spacing.sm
                      }}>
                        <h5 style={{
                          margin: 0,
                          fontSize: theme.typography.sizes.small,
                          fontWeight: theme.typography.weights.medium,
                          color: theme.colors.textSecondary
                        }}>Recommendations:</h5>
                        <ul style={{
                          margin: `${theme.spacing.xs} 0 0 0`,
                          paddingLeft: theme.spacing.lg,
                          fontSize: theme.typography.sizes.small,
                          color: theme.colors.text
                        }}>
                          {result.recommendations.map((rec, index) => (
                            <li key={index} style={{ 
                              marginBottom: theme.spacing.xs,
                              lineHeight: '16px'
                            }}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: 'auto',
        textAlign: 'center',
        padding: theme.spacing.md,
        color: theme.colors.textSecondary,
        fontSize: theme.typography.sizes.small
      }}>
        Made with ❤️ by <a 
          href="https://github.com/opeyemiajagbe" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            color: theme.colors.primary,
            textDecoration: 'none'
          }}
        >
          Opeyemi Ajagbe
        </a>
      </div>
    </div>
  );
};
