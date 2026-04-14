/**
 * @fileoverview Agents page - Display list of all configured agents
 * @author OpenClaw Team
 * @license MIT
 */
import { useState, useEffect } from 'react';
import './Agents.css';

/**
 * Agent information interface matching backend API
 */
export interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  agentDir: string;
  model: string;
  status: 'active' | 'idle' | 'unknown';
  lastActivity?: string;
  skills?: string[];
}

/**
 * API response type
 */
interface AgentsResponse {
  agents: AgentInfo[];
  total: number;
}

/**
 * Status filter options
 */
type StatusFilter = 'all' | 'active' | 'idle' | 'unknown';

/**
 * Props for Agents component
 */
interface AgentsProps {
  onAgentClick?: (agentId: string) => void;
}

/**
 * Agents page component
 * Displays all configured agents with status and auto-refreshes every 10 seconds
 */
export function Agents({ onAgentClick }: AgentsProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  /**
   * Fetch agents from API
   */
  const fetchAgents = async () => {
    try {
      const apiToken = import.meta.env.VITE_API_TOKEN;
      const headers: HeadersInit = {};
      
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      const response = await fetch('/api/agents', { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const data: AgentsResponse = await response.json();
      setAgents(data.agents);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initial fetch and auto-refresh setup
   */
  useEffect(() => {
    fetchAgents();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchAgents, 10000);
    
    return () => clearInterval(interval);
  }, []);

  /**
   * Filter agents based on current status filter
   */
  const filteredAgents = filter === 'all'
    ? agents
    : agents.filter(agent => agent.status === filter);

  /**
   * Get status dot class
   */
  const getStatusDotClass = (status: string) => {
    return `status-dot ${status}`;
  };

  /**
   * Get status text
   */
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'idle':
        return 'Idle';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="agents-page">
        <div className="agents-loading">Loading agents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="agents-page">
        <div className="agents-error">
          <div>Failed to load agents: {error}</div>
          <button className="retry-btn" onClick={fetchAgents}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="agents-page">
      <div className="agents-header">
        <h1 className="agents-title">Agents</h1>
        <div className="agents-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({agents.length})
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active ({agents.filter(a => a.status === 'active').length})
          </button>
          <button
            className={`filter-btn ${filter === 'idle' ? 'active' : ''}`}
            onClick={() => setFilter('idle')}
          >
            Idle ({agents.filter(a => a.status === 'idle').length})
          </button>
          <span className="refresh-info">
            Auto-refreshed at {lastRefreshed.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="agents-grid">
        {filteredAgents.length === 0 ? (
          <div className="no-agents">
            No agents matching the current filter
          </div>
        ) : (
          filteredAgents.map(agent => (
            <div 
              key={agent.id} 
              className="agent-card"
              onClick={() => onAgentClick?.(agent.id)}
            >
              <div className="agent-card-header">
                <span className="agent-name">{agent.name}</span>
                <div className="agent-status-indicator">
                  <div className={getStatusDotClass(agent.status)} />
                  <span className="agent-status-text">{getStatusText(agent.status)}</span>
                </div>
              </div>

              <div className="agent-info-item">
                <label>Agent ID</label>
                <span className="value">{agent.id}</span>
              </div>

              <div className="agent-info-item">
                <label>Model</label>
                <span className="value model">{agent.model}</span>
              </div>

              <div className="agent-info-item">
                <label>Workspace</label>
                <span className="value path">{agent.workspace}</span>
              </div>

              <div className="agent-info-item">
                <label>Agent Directory</label>
                <span className="value path">{agent.agentDir}</span>
              </div>

              {agent.lastActivity && (
                <div className="agent-info-item">
                  <label>Last Activity</label>
                  <span className="value">{new Date(agent.lastActivity).toLocaleString()}</span>
                </div>
              )}

              {agent.skills && agent.skills.length > 0 && (
                <div className="agent-skills">
                  <label>Skills ({agent.skills.length})</label>
                  <div className="skill-tags">
                    {agent.skills.slice(0, 8).map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                    {agent.skills.length > 8 && (
                      <span className="skill-tag">+{agent.skills.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Agents;
