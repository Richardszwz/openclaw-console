/**
 * @fileoverview Session Detail page - Shows full conversation history and token statistics
 *
 * @author OpenClaw Team
 * @license MIT
 */
import { useState, useEffect } from 'react';
import { Session } from './Sessions';
import './SessionDetail.css';

/**
 * Message in conversation history
 */
interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokens?: number;
}

/**
 * Detailed session information with full conversation
 */
interface SessionDetail extends Session {
  messages?: ConversationMessage[];
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Token statistics breakdown
 */
interface TokenStats {
  input: number;
  output: number;
  total: number;
}

/**
 * Props interface
 */
interface SessionDetailProps {
  sessionId: string;
  onBack: () => void;
}

/**
 * Format date to full readable format
 */
function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

/**
 * Format role name for display
 */
function formatRoleName(role: string): string {
  switch (role) {
    case 'user':
      return 'User';
    case 'assistant':
      return 'Assistant';
    case 'system':
      return 'System';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

/**
 * Get CSS class for role
 */
function getRoleClass(role: string): string {
  return `role-${role}`;
}

/**
 * Session Detail page component
 * Displays full conversation history and token usage statistics
 */
function SessionDetail({ sessionId, onBack }: SessionDetailProps) {
  // State
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // API base URL
  const API_BASE = import.meta.env.VITE_API_BASE || '/api';

  /**
   * Fetch session detail from API
   */
  const fetchSessionDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE}/sessions/${sessionId}`;

      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      setSession(data.session || data);
    } catch (err: any) {
      console.error('Failed to fetch session detail:', err);
      setError(err.message || 'Failed to load session detail');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Export session as JSON file
   */
  const exportSession = () => {
    if (!session) return;

    const exportData = {
      ...session,
      exportedAt: new Date().toISOString(),
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${sessionId}-export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Get token statistics from session data
   */
  const getTokenStats = (): TokenStats => {
    if (!session) {
      return { input: 0, output: 0, total: 0 };
    }

    // If we have explicit prompt/completion tokens
    if (session.promptTokens !== undefined && session.completionTokens !== undefined) {
      return {
        input: session.promptTokens,
        output: session.completionTokens,
        total: session.totalTokens || (session.promptTokens + session.completionTokens)
      };
    }

    // If we have messages with individual token counts
    if (session.messages && session.messages.length > 0) {
      let input = 0;
      let output = 0;
      session.messages.forEach(msg => {
        if (msg.tokens) {
          if (msg.role === 'user' || msg.role === 'system') {
            input += msg.tokens;
          } else if (msg.role === 'assistant') {
            output += msg.tokens;
          }
        }
      });
      return {
        input,
        output,
        total: input + output + (session.tokensUsed || 0)
      };
    }

    // Fallback to total tokens only
    return {
      input: 0,
      output: 0,
      total: session.tokensUsed || 0
    };
  };

  // Initial load
  useEffect(() => {
    fetchSessionDetail();
  }, [sessionId]);

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="session-detail-page">
        <div className="loading">Loading session detail...</div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="session-detail-page">
        <div className="error-container">
          <div className="error-message">Error: {error}</div>
          <div className="error-actions">
            <button className="back-btn" onClick={onBack}>
              ← Back to Sessions
            </button>
            <button className="retry-btn" onClick={fetchSessionDetail}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render when no session found
   */
  if (!session) {
    return (
      <div className="session-detail-page">
        <div className="error-container">
          <div className="error-message">Session not found</div>
          <button className="back-btn" onClick={onBack}>
            ← Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  const tokenStats = getTokenStats();

  return (
    <div className="session-detail-page">
      {/* Header with back button and actions */}
      <div className="session-detail-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>
            ← Back to Sessions
          </button>
          <h1 className="session-title">
            Session: {session.title || session.id}
          </h1>
        </div>
        <div className="header-actions">
          <button className="export-btn" onClick={exportSession}>
            📥 Export JSON
          </button>
        </div>
      </div>

      {/* Session information card */}
      <div className="session-info-card">
        <div className="info-grid">
          <div className="info-item">
            <label>Session ID</label>
            <div className="info-value">{session.id}</div>
          </div>
          <div className="info-item">
            <label>Agent</label>
            <div className="info-value">{session.agentName} ({session.agentId})</div>
          </div>
          <div className="info-item">
            <label>Status</label>
            <div className="info-value">
              <span className={`status-badge ${session.status}`}>
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </span>
            </div>
          </div>
          <div className="info-item">
            <label>Created</label>
            <div className="info-value">{formatFullDate(session.createdAt)}</div>
          </div>
          <div className="info-item">
            <label>Last Active</label>
            <div className="info-value">{formatFullDate(session.lastActiveAt)}</div>
          </div>
          <div className="info-item">
            <label>Messages</label>
            <div className="info-value">{session.messageCount || session.messages?.length || 0}</div>
          </div>
        </div>

        {/* Token statistics */}
        <div className="token-stats">
          <h3>Token Usage Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{tokenStats.input.toLocaleString()}</div>
              <div className="stat-label">Input / Prompt Tokens</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{tokenStats.output.toLocaleString()}</div>
              <div className="stat-label">Output / Completion Tokens</div>
            </div>
            <div className="stat-card total">
              <div className="stat-value">{tokenStats.total.toLocaleString()}</div>
              <div className="stat-label">Total Tokens</div>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation history */}
      <div className="conversation-container">
        <h3 className="conversation-title">Conversation History</h3>
        {!session.messages || session.messages.length === 0 ? (
          <div className="no-messages">
            No conversation history available for this session.
          </div>
        ) : (
          <div className="messages-list">
            {session.messages.map((message, index) => (
              <div key={index} className={`message-item ${getRoleClass(message.role)}`}>
                <div className="message-header">
                  <span className="message-role">{formatRoleName(message.role)}</span>
                  {message.timestamp && (
                    <span className="message-time">{formatFullDate(message.timestamp)}</span>
                  )}
                  {message.tokens !== undefined && (
                    <span className="message-tokens">{message.tokens} tokens</span>
                  )}
                </div>
                <div className="message-content">
                  <pre>{message.content}</pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionDetail;
