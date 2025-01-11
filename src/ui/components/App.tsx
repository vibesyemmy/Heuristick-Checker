import * as React from 'react';
import { Layout } from './layout/Layout';
import { Results, HeuristicResult } from './results/Results';
import { theme } from '../styles/theme';

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
}

export class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      isLoading: false,
      error: null,
      selectedElement: null,
      results: [],
      message: null
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
          });
          break;
        case 'analysis-complete':
          this.setState({
            results: message.results,
            isLoading: false,
            message: message.message || null
          });
          break;
        case 'error':
          this.setState({
            error: message.message,
            isLoading: false,
            message: null
          });
          break;
      }
    };
  }

  handleScanElement = () => {
    this.setState({ isLoading: true, error: null, message: null });
    parent.postMessage({ pluginMessage: { type: 'scan-element' } }, '*');
  };

  handleExportResults = () => {
    // TODO: Implement export functionality
    console.log('Export results');
  };

  render() {
    const { isLoading, error, selectedElement, results, message } = this.state;

    return (
      <Layout>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: theme.spacing.md
        }}>
          {/* Header with scan button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            background: 'var(--figma-color-bg-secondary)',
            borderRadius: theme.borderRadius.medium
          }}>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: theme.typography.sizes.heading,
                fontWeight: 500
              }}>
                Heuristic Checker
              </h2>
              <p style={{
                margin: `${theme.spacing.xs} 0 0 0`,
                fontSize: theme.typography.sizes.small,
                color: 'var(--figma-color-text-secondary)'
              }}>
                {selectedElement ? 
                  `Selected: ${selectedElement.name} (${selectedElement.type})` : 
                  'Select an element to analyze'}
              </p>
            </div>
            <button
              onClick={this.handleScanElement}
              disabled={!selectedElement || isLoading}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                background: theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: theme.borderRadius.medium,
                cursor: selectedElement && !isLoading ? 'pointer' : 'not-allowed',
                opacity: selectedElement && !isLoading ? 1 : 0.5,
                fontSize: theme.typography.sizes.body,
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
                fontWeight: 500,
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (selectedElement && !isLoading) {
                  e.currentTarget.style.background = theme.colors.primaryHover;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedElement && !isLoading) {
                  e.currentTarget.style.background = theme.colors.primary;
                }
              }}
            >
              {isLoading ? 'Analyzing...' : 'Scan Element'}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              padding: theme.spacing.md,
              color: theme.colors.danger,
              background: `${theme.colors.danger}15`,
              borderRadius: theme.borderRadius.medium,
              fontSize: theme.typography.sizes.small
            }}>
              {error}
            </div>
          )}

          {/* Results section */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Results
              results={results}
              onExport={results.length > 0 ? this.handleExportResults : undefined}
              message={message || undefined}
            />
          </div>
        </div>
      </Layout>
    );
  }
}
