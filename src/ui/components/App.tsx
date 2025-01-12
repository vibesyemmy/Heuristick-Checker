import * as React from 'react';
import { Layout } from './layout/Layout';
import { Results, HeuristicResult } from './results/Results';
import { theme } from '../styles/theme';
import infoIcon from '../img/info.svg';

interface AppState {
  isLoading: boolean;
  error: string | null;
  selectedElement: {
    id: string;
    name: string;
    type: string;
  } | null;
  results: HeuristicResult[];
  message: string | null;
  hasScanned: boolean;
}

export class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      isLoading: false,
      error: null,
      selectedElement: null,
      results: [],
      message: null,
      hasScanned: false
    };
  }

  componentDidMount() {
    // Initialize plugin message handler
    window.onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (!message) return;

      switch (message.type) {
        case 'selection-change':
          this.setState({
            selectedElement: message.elements[0] || null
            // Don't reset results or hasScanned here
          });
          break;
        case 'analysis-complete':
          this.setState({
            results: message.results,
            isLoading: false,
            message: message.message || null,
            hasScanned: true
          });
          break;
        case 'error':
          this.setState({
            error: message.message,
            isLoading: false,
            message: null,
            hasScanned: true
          });
          break;
      }
    };
  }

  handleScanElement = () => {
    // Reset results only when starting a new scan
    this.setState({ 
      isLoading: true, 
      error: null, 
      message: null,
      results: [], // Clear previous results
      hasScanned: true 
    });
    parent.postMessage({ pluginMessage: { type: 'scan-element' } }, '*');
  };

  handleExportResults = () => {
    // TODO: Implement export functionality
    console.log('Export results');
  };

  render() {
    const { isLoading, error, selectedElement, results, message, hasScanned } = this.state;

    return (
      <Layout>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: theme.spacing.md,
          flex: 1
        }}>
          {/* Header with scan button */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.md
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontFamily: 'Inter',
                fontWeight: 700,
                lineHeight: '32px'
              }}>
                Heuristic Checker
              </h2>
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: theme.colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <img 
                  src={infoIcon} 
                  alt="Info"
                  style={{ 
                    width: '16px', 
                    height: '16px' 
                  }}
                />
                {selectedElement ? (
                  <>
                    Selected element: <span style={{ 
                      color: 'white', 
                      fontWeight: 600 
                    }}>{selectedElement.name} ({selectedElement.type})</span>
                  </>
                ) : 'Select an element to analyze'}
              </p>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '32px'
            }}>
              <button
                onClick={this.handleScanElement}
                disabled={!selectedElement || isLoading}
                style={{
                  background: theme.colors.primary,
                  color: 'white',
                  border: 'none',
                  height: '48px',
                  borderRadius: theme.borderRadius.large,
                  cursor: 'pointer',
                  fontSize: theme.typography.sizes.button,
                  fontFamily: theme.typography.fontFamily,
                  fontWeight: theme.typography.weights.semibold,
                  width: '100%',
                  transition: 'background-color 0.2s'
                }}
              >
                {isLoading ? 'Analyzing...' : 'Scan Element'}
              </button>

              <Results 
                results={results}
                selectedElement={!!selectedElement}
                hasScanned={hasScanned}
                onExport={results.length > 0 ? this.handleExportResults : undefined}
                message={message || undefined}
                error={error || undefined}
              />
            </div>
          </div>
        </div>
      </Layout>
    );
  }
}
