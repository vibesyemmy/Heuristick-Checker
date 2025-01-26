import * as React from 'react';
import { theme } from '../../styles/theme';
import folderImage from '../../img/folder.png';
import confettiImage from '../../img/confett.png';

export type Severity = 'low' | 'medium' | 'high';

export interface HeuristicResult {
  id: string;
  nodeId: string;  // Figma node ID
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
  selectedResultId?: string;
  onSelectResult: (resultId: string) => void;
}

export const Results: React.FC<ResultsProps> = ({
  results,
  onExport,
  message,
  selectedElement,
  hasScanned,
  error,
  selectedResultId,
  onSelectResult
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

  const ResultCard: React.FC<{ result: HeuristicResult; isSelected: boolean; onSelect: () => void }> = ({ result, isSelected, onSelect }) => {
    return (
      <div
        onClick={onSelect}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '16px',
          background: isSelected ? theme.colors.backgroundTertiary : 'transparent',
          borderBottom: '1px solid #3E3E3E',
          cursor: 'pointer'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            flex: 1
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: theme.typography.weights.medium,
                color: '#FFFFFF'
              }}>{result.title}</h3>
              <div style={{
                padding: '2px 8px',
                background: getSeverityColor(result.severity),
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: theme.typography.weights.medium,
                color: '#FFFFFF'
              }}>
                {getSeverityLabel(result.severity)}
              </div>
            </div>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#FFFFFF',
              opacity: 0.8
            }}>{result.description}</p>
          </div>
        </div>
        
        {result.recommendations && result.recommendations.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <h4 style={{
              margin: 0,
              fontSize: '12px',
              fontWeight: theme.typography.weights.medium,
              color: '#FFFFFF',
              opacity: 0.8
            }}>Recommendations:</h4>
            <ul style={{
              margin: 0,
              paddingLeft: '20px',
              fontSize: '12px',
              color: '#FFFFFF',
              opacity: 0.8
            }}>
              {result.recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
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
              width: '100%',
              padding: 0
            }}>
              {results.map(result => (
                <ResultCard 
                  key={result.id} 
                  result={result} 
                  isSelected={selectedResultId === result.id} 
                  onSelect={() => onSelectResult(result.id)} 
                />
              ))}
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
