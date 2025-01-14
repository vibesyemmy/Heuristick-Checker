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
  selectedResultId: string | null;
}

export class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      isLoading: false,
      error: null,
      selectedElement: null,  // Will be updated by initial selection message
      results: [],
      message: null,
      hasScanned: false,
      selectedResultId: null
    };
  }

  componentDidMount() {
    // Initialize plugin message handler
    window.onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (!message) return;

      switch (message.type) {
        case 'selection-change':
          const selectedElement = message.elements[0] || null;
          // Only update the selectedElement, keep other state
          this.setState({
            selectedElement
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

  handleResultSelect = (resultId: string) => {
    const result = this.state.results.find(r => r.id === resultId);
    if (result) {
      // Send message to Figma to select the node
      parent.postMessage({ 
        pluginMessage: { 
          type: 'select-node', 
          nodeId: result.nodeId 
        } 
      }, '*');
      
      this.setState({ selectedResultId: resultId });
    }
  };

  render() {
    const { isLoading, error, selectedElement, results, message, hasScanned, selectedResultId } = this.state;

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
                gap: '4px',
                minWidth: 0  // Allow flex item to shrink below its minimum content size
              }}>
                <img 
                  src={infoIcon} 
                  alt="Info"
                  style={{ 
                    width: '16px', 
                    height: '16px',
                    flexShrink: 0  // Prevent icon from shrinking
                  }}
                />
                {selectedElement ? (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    minWidth: 0,  // Allow flex item to shrink
                    whiteSpace: 'nowrap',  // Prevent text from wrapping
                    overflow: 'hidden'  // Hide overflow
                  }}>
                    Selected element: <span style={{ 
                      color: 'white', 
                      fontWeight: 600,
                      textOverflow: 'ellipsis',  // Add ellipsis for overflow
                      overflow: 'hidden'  // Hide overflow
                    }}>{selectedElement.name} ({selectedElement.type})</span>
                  </span>
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
                  background: !selectedElement ? theme.colors.border : theme.colors.primary,
                  color: !selectedElement ? theme.colors.textSecondary : 'white',
                  border: 'none',
                  height: '48px',
                  borderRadius: theme.borderRadius.large,
                  cursor: !selectedElement ? 'not-allowed' : 'pointer',
                  fontSize: theme.typography.sizes.button,
                  fontFamily: theme.typography.fontFamily,
                  fontWeight: theme.typography.weights.semibold,
                  width: '100%',
                  transition: 'all 0.2s ease',
                  opacity: !selectedElement ? 0.7 : 1
                }}
              >
                {isLoading ? 'Analyzing...' : !selectedElement ? 'Select an element to scan' : 'Scan Element'}
              </button>

              <Results 
                results={results}
                selectedElement={!!selectedElement}
                hasScanned={hasScanned}
                error={error || undefined}
                message={message || undefined}
                selectedResultId={selectedResultId || undefined}
                onSelectResult={this.handleResultSelect}
              />
            </div>
          </div>
        </div>
      </Layout>
    );
  }
}
