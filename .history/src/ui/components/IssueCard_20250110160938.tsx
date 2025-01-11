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
      case 'ERROR':
        return 'issue-card--error';
      case 'WARNING':
        return 'issue-card--warning';
      case 'INFO':
        return 'issue-card--info';
      default:
        return '';
    }
  };

  const getTypeIcon = () => {
    switch (issue.type) {
      case 'TEXT':
        return '📝';
      case 'STYLE':
        return '🎨';
      case 'SIZE':
        return '📐';
      case 'STATE':
        return '🔄';
      case 'PATTERN':
        return '🔍';
      default:
        return '❓';
    }
  };

  const formatAffectedNodes = () => {
    if (issue.affectedNodes.length === 0) return 'No affected nodes';
    if (issue.affectedNodes.length === 1) return '1 affected node';
    return `${issue.affectedNodes.length} affected nodes`;
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
        <span className={`issue-card__severity issue-card__severity--${issue.severity.toLowerCase()}`}>
          {issue.severity}
        </span>
      </div>
      <div className="issue-card__content">
        <h3 className="issue-card__message">{issue.title}</h3>
        <p className="issue-card__description">{issue.description}</p>
      </div>
      <div className="issue-card__footer">
        <span className="issue-card__affected">
          {formatAffectedNodes()}
        </span>
      </div>
    </div>
  );
};

export default IssueCard;
