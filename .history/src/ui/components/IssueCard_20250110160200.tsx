import React from 'react';
import { StyleIssue } from '../../heuristics/button-checker/types';
import './styles.css';

interface IssueCardProps {
  issue: StyleIssue;
  onSelect: (issue: StyleIssue) => void;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, onSelect }) => {
  const getSeverityClass = () => {
    switch (issue.severity) {
      case 'error':
        return 'issue-card--error';
      case 'warning':
        return 'issue-card--warning';
      case 'info':
        return 'issue-card--info';
      default:
        return '';
    }
  };

  const getTypeIcon = () => {
    switch (issue.type) {
      case 'style':
        return '🎨';
      case 'pattern':
        return '🔍';
      default:
        return '❓';
    }
  };

  const handleClick = () => {
    onSelect(issue);
  };

  return (
    <div
      className={`issue-card ${getSeverityClass()}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      <div className="issue-card__header">
        <span className="issue-card__icon">{getTypeIcon()}</span>
        <span className="issue-card__type">{issue.type}</span>
        <span className={`issue-card__severity issue-card__severity--${issue.severity}`}>
          {issue.severity}
        </span>
      </div>
      <div className="issue-card__content">
        <h3 className="issue-card__message">{issue.message}</h3>
        {issue.details && (
          <div className="issue-card__details">
            <p>Expected: {JSON.stringify(issue.details.expected)}</p>
            <p>Actual: {JSON.stringify(issue.details.actual)}</p>
          </div>
        )}
      </div>
      <div className="issue-card__footer">
        <span className="issue-card__affected">
          {issue.affectedNodes.length} affected {issue.affectedNodes.length === 1 ? 'element' : 'elements'}
        </span>
      </div>
    </div>
  );
};

export default IssueCard;
