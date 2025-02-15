import * as React from 'react';
import { ValidationResult, TypographyIssue } from '../../plugin/heuristics/typography/types';

interface Props {
  results: ValidationResult[];
}

const ValidationResults: React.FC<Props> = ({ results }) => {
  const renderIssue = (issue: TypographyIssue) => {
    const isDesignSystem = issue.message.includes('(Design System)');
    const isAuto = issue.message.includes('(Auto)');
    
    const severityColor = {
      error: '#FF3B30',
      warning: '#FF9500',
      info: '#007AFF'
    }[issue.severity];

    const badge = isDesignSystem ? (
      <span style={{
        background: '#007AFF',
        color: 'white',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '12px',
        marginLeft: '8px'
      }}>
        Design System
      </span>
    ) : null;

    return (
      <div key={`${issue.type}-${issue.node.id}`} style={{
        padding: '12px',
        borderRadius: '6px',
        background: 'rgba(0,0,0,0.05)',
        marginBottom: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ 
            color: severityColor,
            fontWeight: 500,
            marginRight: '8px'
          }}>
            {issue.type}
          </span>
          {badge}
        </div>
        
        <p style={{ margin: '0 0 8px 0' }}>
          {issue.message.replace(' (Design System)', '')}
        </p>
        
        {issue.suggestion && (
          <p style={{ 
            margin: '0',
            fontSize: '14px',
            color: '#666'
          }}>
            Suggestion: {issue.suggestion}
          </p>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '16px' }}>
      {results.map((result, index) => (
        <div key={index}>
          {result.issues.map(renderIssue)}
        </div>
      ))}
      
      {results.length === 0 && (
        <p style={{ 
          textAlign: 'center',
          color: '#666'
        }}>
          No typography issues found
        </p>
      )}
    </div>
  );
};

export default ValidationResults;
