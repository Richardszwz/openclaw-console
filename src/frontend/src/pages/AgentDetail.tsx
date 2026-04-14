/**
 * @fileoverview Agent Detail page - Display detailed information about a specific agent
 * @author OpenClaw Team
 * @license MIT
 */
import { useState, useEffect } from 'react';
import './AgentDetail.css';
import { AgentInfo } from './Agents';

/**
 * Agent statistics interface matching backend API
 */
export interface AgentStats {
  totalSessions: number;
  totalTokensUsed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  sessionCountLast7Days: number;
  tokensLast7Days: number;
}

/**
 * Props for AgentDetail component
 */
interface AgentDetailProps {
  agentId: string;
  onBack: () => void;
}

/**
 * Agent Detail page component
 * Displays detailed information about a specific agent including usage statistics
 */
export function AgentDetail({ agentId, onBack }: AgentDetailProps) {
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch agent details from API
   */
  const fetchAgentDetails = async () => {
    try {
      const apiToken = import.meta.env.VITE_API_TOKEN;
      const headers: HeadersInit = {};
      
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      // Fetch agent basic info
      const agentResponse = await fetch(`/api/agents/${agentId}`, { headers });
      
      if (!agentResponse.ok) {
        throw new Error(`HTTP error: ${agentResponse.status} ${agentResponse.statusText}`);
      }

      const agentData = await agentResponse.json();
      setAgent(agentData.agent);

      // Fetch agent statistics
      const statsResponse = await fetch(`/api/agents/${agentId}/stats`, { headers });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to fetch agent details:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchAgentDetails();
  }, [agentId]);

  /**
   * Format large numbers with commas
   */
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <div className="agent-detail-page">
        <div className="agent-detail-loading">Loading agent details...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="agent-detail-page">
        <div className="agent-detail-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Agents
          </button>
          <h1 className="agent-detail-title">Agent Details</h1>
        </div>
        <div className="agent-detail-error">
          <div>Failed to load agent details: {error}</div>
          <button className="retry-btn" onClick={fetchAgentDetails}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-detail-page">
      <div className="agent-detail-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Agents
        </button>
        <h1 className="agent-detail-title">Agent Details</h1>
      </div>

      <div className="agent-detail-content">
        <div className="detail-card basic-info">
          <h2>Basic Information</h2>
          <div className="detail-grid">
            <div className="detail-item">
              <label>Agent Name</label>
              <span className="value name">{agent.name}</span>
            </div>

            <div className="detail-item">
              <label>Agent ID</label>
              <span className="value id">{agent.id}</span>
            </div>

            <div className="detail-item">
              <label>Model</label>
              <span className="value model">{agent.model}</span>
            </div>

            <div className="detail-item">
              <label>Status</label>
              <div className="status-wrapper">
                <div className={`status-dot ${agent.status}`} />
                <span className="value status">{agent.status}</span>
              </div>
            </div>

            <div className="detail-item full-width">
              <label>Workspace Path</label>
              <span className="value path">{agent.workspace}</span>
            </div>

            <div className="detail-item full-width">
              <label>Agent Directory</label>
              <span className="value path">{agent.agentDir}</span>
            </div>

            {agent.lastActivity && (
              <div className="detail-item">
                <label>Last Activity</label>
                <span className="value">{new Date(agent.lastActivity).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {agent.skills && agent.skills.length > 0 && (
          <div className="detail-card skills-section">
            <h2>Installed Skills ({agent.skills.length})</h2>
            <div className="skills-list">
              {agent.skills.map(skill => (
                <span key={skill} className="skill-tag">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {stats && (
          <div className="detail-card stats-section">
            <h2>Usage Statistics</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{formatNumber(stats.totalSessions)}</div>
                <div className="stat-label">Total Sessions</div>
              </div>

              <div className="stat-item">
                <div className="stat-value">{formatNumber(stats.totalTokensUsed)}</div>
                <div className="stat-label">Total Tokens</div>
              </div>

              <div className="stat-item">
                <div className="stat-value">{formatNumber(stats.totalInputTokens)}</div>
                <div className="stat-label">Input Tokens</div>
              </div>

              <div className="stat-item">
                <div className="stat-value">{formatNumber(stats.totalOutputTokens)}</div>
                <div className="stat-label">Output Tokens</div>
              </div>

              <div className="stat-item">
                <div className="stat-value">{formatNumber(stats.sessionCountLast7Days)}</div>
                <div className="stat-label">Sessions (Last 7 days)</div>
              </div>

              <div className="stat-item">
                <div className="stat-value">{formatNumber(stats.tokensLast7Days)}</div>
                <div className="stat-label">Tokens (Last 7 days)</div>
              </div>
            </div>
            {stats.totalSessions === 0 && (
              <div className="stats-note">No usage data available for this agent yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentDetail;
