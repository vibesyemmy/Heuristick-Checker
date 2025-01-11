import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './components/App';
import './styles.css';

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
