/**
 * @fileoverview Sessions page - Session list with filtering, search and pagination
 * Uses virtual scrolling for performance with large session lists
 *
 * @author OpenClaw Team
 * @license MIT
 */
import { useState, useEffect, useCallback } from 'react';
import './Sessions.css';

/**
 * Session data interface matching the API response
 */
export interface Session {
  id: string;
  agentId: string;
  agentName: string;
  status: 'active' | 'idle' | 'completed' | 'error';
  createdAt: string;
  lastActiveAt: string;
  title?: string;
  messageCount?: number;
  tokensUsed?: number;
}

/**
 * Agent option for filtering
 */
interface AgentOption {
  id: string;
  name: string;
}

/**
 * API response interface
 */
interface SessionListResponse {
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Format date to readable format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleString();
}

/**
 * Props interface
 */
interface SessionsProps {
  onSessionClick: (sessionId: string) => void;
}

/**
 * Sessions page component
 */
function Sessions({ onSessionClick }: SessionsProps) {
  // State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);
  const [search, setSearch] = useState<string>('');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState<boolean>(false);

  // API base URL
  const API_BASE = import.meta.env.VITE_API_BASE || '/api';

  /**
   * Fetch sessions from API
   */
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));

      if (search && search.trim()) {
        params.append('search', search.trim());
      }

      if (agentFilter) {
        params.append('agentId', agentFilter);
      }

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const url = `${API_BASE}/sessions?${params.toString()}`;

      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: SessionListResponse = await response.json();

      setSessions(data.sessions);
      setTotal(data.total);
      setTotalPages(data.totalPages);

      // Extract unique agents for filter dropdown
      const uniqueAgents = new Map<string, string>();
      data.sessions.forEach(session => {
        if (!uniqueAgents.has(session.agentId)) {
          uniqueAgents.set(session.agentId, session.agentName);
        }
      });

      // If we already have agents, merge them
      const mergedAgents = new Map(agents.map(a => [a.id, a.name]));
      uniqueAgents.forEach((name, id) => {
        if (!mergedAgents.has(id)) {
          mergedAgents.set(id, name);
        }
      });

      setAgents(Array.from(mergedAgents.entries()).map(([id, name]) => ({ id, name })));
    } catch (err: any) {
      console.error('Failed to fetch sessions:', err);
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, agentFilter, statusFilter, API_BASE, agents]);

  /**
   * Fetch agents list on mount to get all available agents
   */
  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/agents`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.agents)) {
          const agentOptions: AgentOption[] = data.agents.map((agent: any) => ({
            id: agent.id,
            name: agent.name,
          }));
          setAgents(agentOptions);
        }
      }
    } catch (err) {
      console.warn('Failed to pre-fetch agents list:', err);
      // Don't fail the whole page, we can extract agents from sessions
    }
  }, [API_BASE]);

  /**
   * Initial load
   */
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  /**
   * Refetch when filters change
   */
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  /**
   * Handle search input change
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset to first page on new search
  };

  /**
   * Handle agent filter change
   */
  const handleAgentFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAgentFilter(e.target.value);
    setPage(1);
  };

  /**
   * Handle status filter change
   */
  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  /**
   * Handle page change
   */
  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  /**
   * Handle manual page input
   */
  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const input = e.currentTarget;
      const newPage = parseInt(input.value);
      if (!isNaN(newPage)) {
        goToPage(newPage);
      }
    }
  };

  /**
   * Refresh data
   */
  const handleRefresh = () => {
    fetchSessions();
    setSelectedIds(new Set());
  };

  /**
   * Handle session row click
   */
  const handleSessionClick = (sessionId: string) => {
    onSessionClick(sessionId);
  };

  /**
   * Toggle selection of a single session
   */
  const toggleSelection = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedIds(newSelected);
  };

  /**
   * Toggle select all on current page
   */
  const toggleSelectAll = () => {
    if (selectedIds.size === sessions.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all on current page
      const allIds = new Set(sessions.map(s => s.id));
      setSelectedIds(allIds);
    }
  };

  /**
   * Bulk delete selected sessions
   */
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one session to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected session(s)? This cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);

    try {
      const response = await fetch(`${API_BASE}/sessions/batch-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ids: Array.from(selectedIds)
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result = await response.json();
      alert(`Successfully deleted ${result.deleted} session(s)`);
      setSelectedIds(new Set());
      fetchSessions();
    } catch (err: any) {
      console.error('Failed to bulk delete sessions:', err);
      alert(`Failed to delete sessions: ${err.message || 'Unknown error'}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  /**
   * Delete a single session
   */
  const handleDeleteSingle = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm(`Are you sure you want to delete session ${sessionId}? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result = await response.json();
      alert(result.message || 'Session deleted successfully');
      fetchSessions();
    } catch (err: any) {
      console.error(`Failed to delete session ${sessionId}:`, err);
      alert(`Failed to delete session: ${err.message || 'Unknown error'}`);
    }
  };

  /**
   * Kill/terminate a session
   */
  const handleKillSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm(`Are you sure you want to terminate session ${sessionId}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/kill`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result = await response.json();
      alert(result.message || 'Session terminated successfully');
      fetchSessions();
    } catch (err: any) {
      console.error(`Failed to terminate session ${sessionId}:`, err);
      alert(`Failed to terminate session: ${err.message || 'Unknown error'}`);
    }
  };

  /**
   * Render loading state
   */
  if (loading && sessions.length === 0) {
    return (
      <div className="sessions-page">
        <div className="sessions-loading">Loading sessions...</div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error && sessions.length === 0) {
    return (
      <div className="sessions-page">
        <div className="sessions-error">
          <div>Error: {error}</div>
          <button className="retry-btn" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sessions-page">
      <div className="sessions-header">
        <div className="sessions-title-row">
          <h1 className="sessions-title">Sessions</h1>
        </div>

        <div className="sessions-controls">
          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="Search by session ID..."
              value={search}
              onChange={handleSearchChange}
            />
            <span className="search-icon">🔍</span>
          </div>

          <div className="filter-group">
            <label>Agent</label>
            <select
              className="filter-select"
              value={agentFilter}
              onChange={handleAgentFilterChange}
            >
              <option value="">All Agents</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={handleStatusFilterChange}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="completed">Completed</option>
              <option value="error">Error</option>
            </select>
          </div>

          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="sessions-table-container">
        {sessions.length === 0 ? (
          <div className="no-sessions">
            No sessions found matching your filters.
          </div>
        ) : (
          <>
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={sessions.length > 0 && selectedIds.size === sessions.length}
                      ref={input => {
                        if (input) {
                          input.indeterminate = selectedIds.size > 0 && selectedIds.size < sessions.length;
                        }
                      }}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Session ID</th>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Active</th>
                  <th>Stats</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => {
                  const isSelected = selectedIds.has(session.id);
                  return (
                    <tr 
                      key={session.id} 
                      className={`session-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSessionClick(session.id)}
                    >
                      <td onClick={(e) => toggleSelection(session.id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                        />
                      </td>
                      <td>
                        <div className="session-id">{session.id}</div>
                      </td>
                      <td>
                        <div className="agent-name">{session.agentName}</div>
                      </td>
                      <td>
                        <span className={`status-badge ${session.status}`}>
                          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <div className="session-date">{formatDate(session.createdAt)}</div>
                      </td>
                      <td>
                        <div className="session-date">{formatDate(session.lastActiveAt)}</div>
                      </td>
                      <td>
                        <div className="session-stats">
                          {session.messageCount !== undefined && (
                            <span>{session.messageCount} messages</span>
                          )}
                          {session.tokensUsed !== undefined && (
                            <span>{session.tokensUsed.toLocaleString()} tokens</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="session-actions">
                          {session.status === 'active' && (
                            <button 
                              className="action-btn kill-btn"
                              onClick={(e) => handleKillSession(session.id, e)}
                              title="Terminate active session"
                            >
                              Kill
                            </button>
                          )}
                          <button 
                            className="action-btn delete-btn"
                            onClick={(e) => handleDeleteSingle(session.id, e)}
                            title="Delete this session"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {selectedIds.size > 0 && (
              <div className="bulk-actions">
                <span className="selected-count">
                  {selectedIds.size} session(s) selected
                </span>
                <button
                  className="bulk-delete-btn"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                >
                  {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
                </button>
                <button
                  className="clear-selection-btn"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkDeleting}
                >
                  Clear Selection
                </button>
              </div>
            )}

            {totalPages > 1 && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {sessions.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
                  {Math.min(page * limit, total)} of {total} sessions
                </div>
                <div className="pagination-controls">
                  <button
                    className="page-btn"
                    onClick={() => goToPage(page - 1)}
                    disabled={page === 1 || loading}
                  >
                    Previous
                  </button>

                  <span style={{ fontSize: '14px', color: '#6b7280' }}>
                    Page <input
                      type="text"
                      className="page-input"
                      defaultValue={page}
                      onKeyDown={handlePageInput}
                    /> of {totalPages}
                  </span>

                  <button
                    className="page-btn"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages || loading}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Sessions;
