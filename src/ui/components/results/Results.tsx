import * as React from 'react';
import { theme } from '../../styles/theme';
import folderImage from '../../img/folder.png';
import confettiImage from '../../img/confett.png';

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
  selectedElement: boolean;
  hasScanned: boolean;
  error?: string;
}

export const Results: React.FC<ResultsProps> = ({
  results,
  onExport,
  message,
  selectedElement,
  hasScanned,
  error
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
          color: '#FFFFFF',
          fontFamily: theme.typography.fontFamily,
          fontWeight: theme.typography.weights.regular,
          lineHeight: '20px'
        }}>
          {results.length > 0 
            ? <>We found <span style={{ fontWeight: theme.typography.weights.semibold }}>{results.length}</span> {results.length === 1 ? 'issue' : 'issues'} to address</>
            : hasScanned 
              ? <>We found <span style={{ fontWeight: theme.typography.weights.semibold }}>0</span> issues to address</> 
              : 'Analysis results will show here'}
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: results.length === 0 ? 'center' : 'stretch',
          justifyContent: results.length === 0 ? 'center' : 'flex-start',
          background: theme.colors.backgroundSecondary,
          padding: 0,
          borderRadius: theme.borderRadius.large,
          height: '462px',
          width: '100%',
          overflow: 'auto',
          border: '1px solid #3E3E3E'
        }}>
          {!hasScanned ? (
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
                  lineHeight: '20px',
                  width: '288px'
                }}>
                  Choose an element and hit 'Scan Element' to start your heuristic analysis.
                </p>
              </div>
            </div>
          ) : error ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              textAlign: 'center',
              padding: theme.spacing.xl
            }}>
              <div style={{
                padding: theme.spacing.md,
                color: theme.colors.danger,
                background: `${theme.colors.danger}15`,
                borderRadius: theme.borderRadius.medium,
                fontSize: theme.typography.sizes.small,
                width: '100%',
                textAlign: 'left'
              }}>
                {error}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              textAlign: 'center',
              padding: theme.spacing.xl
            }}>
              <img 
                src={confettiImage} 
                alt="Confetti celebration"
                style={{ width: '160px', height: '160px' }}
              />
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: theme.typography.weights.bold,
                  color: 'rgba(255, 255, 255, 0.64)',
                  lineHeight: '24px'
                }}>
                  Your element seems clean!
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.32)',
                  lineHeight: '20px'
                }}>
                  Great job! This element meets all the rules.
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.xs,
              width: '100%'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: theme.spacing.xs
              }}>
                {results.map(result => (
                  <div
                    key={result.id}
                    style={{
                      padding: theme.spacing.md,
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 0,
                      borderLeft: `6px solid ${getSeverityColor(result.severity)}`,
                      width: '100%'
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
                          fontSize: '16px',
                          color: 'rgba(255, 255, 255, 0.95)',
                          fontWeight: theme.typography.weights.medium
                        }}>{result.title}</h4>
                        <p style={{
                          margin: `${theme.spacing.xs} 0 0 0`,
                          fontSize: '12px',
                          color: 'rgba(255, 255, 255, 0.65)'
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
                        marginTop: theme.spacing.sm,
                        padding: theme.spacing.sm,
                        border: '1px solid #595753',
                        borderRadius: theme.spacing.sm
                      }}>
                        <h5 style={{
                          margin: 0,
                          fontSize: '14px',
                          fontWeight: theme.typography.weights.semibold,
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          gap: theme.spacing.xs
                        }}>
                          <span style={{ color: '#4CAF50', fontSize: '16px' }}>★</span>
                          Recommendations
                        </h5>
                        <ul style={{
                          margin: `${theme.spacing.xs} 0 0 0`,
                          paddingLeft: theme.spacing.lg,
                          listStyle: 'disc'
                        }}>
                          {result.recommendations?.map((recommendation, index) => (
                            <li 
                              key={index}
                              style={{
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.64)',
                                marginBottom: index < (result.recommendations?.length ?? 0) - 1 ? theme.spacing.xs : 0,
                                lineHeight: '16px'
                              }}
                            >
                              {recommendation}
                            </li>
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
