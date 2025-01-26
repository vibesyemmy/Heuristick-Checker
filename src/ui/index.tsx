import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './components/App';
import './styles.css';

interface Issue {
  type: 'text-contrast' | 'icon-contrast';
  nodeId: string;
  nodeName: string;
  category?: string;
  title?: string;
  description?: string;
  severity?: 'high' | 'medium' | 'low';
  // Text contrast specific
  textColor?: string;
  backgroundColor?: string;
  contrastRatio?: number;
  requiredRatio?: number;
  recommendations?: string[];
  // Icon contrast specific
  role?: 'interactive' | 'informative' | 'decorative';
  colors?: {
    original: string;
    blended: string;
    coverage: number;
    contrastRatio: number;
  }[];
  failingColors?: string[];
}

function IssueCard({ issue }: { issue: Issue }) {
  return (
    <div className="issue-card">
      <div className="issue-header">
        <h3>{issue.type === 'icon-contrast' ? 'Icon Contrast Issue' : issue.title}</h3>
        {issue.severity && (
          <span className={`severity-badge ${issue.severity}`}>
            {issue.severity.toUpperCase()}
          </span>
        )}
      </div>
      
      <div className="issue-details">
        <p><strong>Element:</strong> {issue.nodeName}</p>
        
        {issue.type === 'text-contrast' ? (
          // Text contrast specific details
          <>
            <p><strong>Text Color:</strong> {issue.textColor}</p>
            <p><strong>Background:</strong> {issue.backgroundColor}</p>
            <p><strong>Contrast Ratio:</strong> {issue.contrastRatio?.toFixed(2)}:1</p>
            <p><strong>Required Ratio:</strong> {issue.requiredRatio}:1</p>
          </>
        ) : (
          // Icon contrast specific details
          <>
            <p><strong>Role:</strong> {issue.role}</p>
            <p><strong>Required Ratio:</strong> {issue.requiredRatio}:1</p>
            <div className="color-list">
              <strong>Colors:</strong>
              {issue.colors?.map((color, index) => (
                <div key={index} className="color-item">
                  <div className="color-preview" style={{ backgroundColor: color.original }} />
                  <span>
                    {color.original} ({color.contrastRatio.toFixed(2)}:1)
                    {color.contrastRatio < (issue.requiredRatio || 3) && ' ⚠️'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        
        {issue.recommendations && issue.recommendations.length > 0 && (
          <div className="recommendations">
            <strong>Recommendations:</strong>
            <ul>
              {issue.recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function init() {
  try {
    const rootElement = document.getElementById('react-page');
    if (!rootElement) {
      throw new Error('Root element #react-page not found');
    }

    ReactDOM.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
      rootElement
    );

    console.log('React initialized successfully');
  } catch (error) {
    console.error('Failed to initialize React:', error);
    // Show error in UI
    const rootElement = document.getElementById('react-page');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="color: red; padding: 20px;">
          <h2>Failed to initialize React</h2>
          <pre>${error instanceof Error ? error.message : 'Unknown error'}</pre>
        </div>
      `;
    }
  }
}

// Handle initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
