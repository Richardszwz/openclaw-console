/**
 * @fileoverview Logs Viewer page
 * Real-time log streaming with filtering, search and export capabilities
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import React, { useState, useEffect, useRef } from 'react';
import './Logs.css';

/** Log entry interface matching backend API */
export interface LogEntry {
  timestamp: number;
  datetime: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'trace';
  message: string;
  raw: string;
}

/** Log levels with colors and labels */
const LOG_LEVELS = [
  { value: 'debug', label: 'Debug', color: '#6b7280' },
  { value: 'info', label: 'Info', color: '#3b82f6' },
  { value: 'warn', label: 'Warn', color: '#f59e0b' },
  { value: 'error', label: 'Error', color: '#ef4444' },
  { value: 'trace', label: 'Trace', color: '#8b5cf6' },
] as const;

/**
 * Logs Viewer Component
 */
const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(
    new Set(['info', 'warn', 'error'])
  );
  const [searchText, setSearchText] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [tailLines] = useState<number>(100);
  const [isLive, setIsLive] = useState<boolean>(true);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimestampRef = useRef<number>(0);

  /**
   * Get level color for styling
   */
  const getLevelColor = (level: string): string => {
    const found = LOG_LEVELS.find(l => l.value === level);
    return found?.color || '#6b7280';
  };

  /**
   * Get level label
   */
  const getLevelLabel = (level: string): string => {
    const found = LOG_LEVELS.find(l => l.value === level);
    return found?.label || level.toUpperCase();
  };

  /**
   * Toggle level selection
   */
  const toggleLevel = (level: string) => {
    const newSelected = new Set(selectedLevels);
    if (newSelected.has(level)) {
      newSelected.delete(level);
    } else {
      newSelected.add(level);
    }
    setSelectedLevels(newSelected);
  };

  /**
   * Select all levels
   */
  const selectAllLevels = () => {
    setSelectedLevels(new Set(LOG_LEVELS.map(l => l.value)));
  };

  /**
   * Clear all level selections
   */
  const clearAllLevels = () => {
    setSelectedLevels(new Set());
  };

  /**
   * Fetch logs from API
   */
  const fetchLogs = async (append: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters for tail
      const levelParams = Array.from(selectedLevels).join(',');
      const url = `/api/logs/tail?lines=${tailLines}${levelParams ? `&level=${levelParams}` : ''}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Entries come in newest first, reverse to get oldest first for display
      const newEntries = [...data.entries].reverse();
      
      if (append && logs.length > 0) {
        // Only add new entries that came after last timestamp
        const newEntriesToAdd = newEntries.filter(
          entry => entry.timestamp > lastTimestampRef.current
        );
        if (newEntriesToAdd.length > 0) {
          const combined = [...logs, ...newEntriesToAdd];
          setLogs(combined);
          if (combined.length > 5000) {
            // Keep memory usage reasonable
            setLogs(combined.slice(-5000));
          }
        }
      } else {
        setLogs(newEntries);
      }
      
      // Update last timestamp
      if (newEntries.length > 0) {
        lastTimestampRef.current = Math.max(...newEntries.map(e => e.timestamp));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Export logs to file
   */
  const exportLogs = () => {
    const content = filteredLogs.map(log => log.raw).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openclaw-logs-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Clear all logs from view
   */
  const clearLogs = () => {
    setLogs([]);
    lastTimestampRef.current = 0;
  };

  /**
   * Refresh logs manually
   */
  const refreshLogs = () => {
    fetchLogs(false);
  };

  /**
   * Scroll to bottom when new logs come in if auto-scroll is enabled
   */
  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  /**
   * Toggle live update
   */
  const toggleLive = () => {
    setIsLive(!isLive);
  };

  /**
   * Restart Gateway action
   */
  const handleRestartGateway = async () => {
    if (!window.confirm('确定要重启 Gateway 吗？这会导致所有连接断开。')) {
      return;
    }
    try {
      const response = await fetch('/api/gateway/restart', { method: 'POST' });
      const data = await response.json();
      if (data.error) {
        alert(`重启失败: ${data.error}`);
      } else {
        alert('重启命令已发送');
      }
    } catch (err: any) {
      alert(`请求失败: ${err.message}`);
    }
  };

  /**
   * Stop Gateway action
   */
  const handleStopGateway = async () => {
    if (!window.confirm('⚠️ 警告：确定要停止 Gateway 吗？\n停止后 OpenClaw 将无法接收消息，需要手动重启才能恢复。\n\n确认停止吗？')) {
      return;
    }
    try {
      const response = await fetch('/api/gateway/stop', { method: 'POST' });
      const data = await response.json();
      if (data.error) {
        alert(`停止失败: ${data.error}`);
      } else {
        alert('停止命令已发送');
      }
    } catch (err: any) {
      alert(`请求失败: ${err.message}`);
    }
  };

  /**
   * Filter logs based on search text and selected levels
   */
  useEffect(() => {
    let filtered = [...logs];
    
    // Filter by level
    filtered = filtered.filter(log => selectedLevels.has(log.level));
    
    // Filter by search text
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        log.raw.toLowerCase().includes(searchLower) ||
        log.level.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredLogs(filtered);
  }, [logs, selectedLevels, searchText]);

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchLogs(false);
  }, []);

  /**
   * Set up polling for live updates
   */
  useEffect(() => {
    if (isLive) {
      pollIntervalRef.current = setInterval(() => {
        fetchLogs(true);
      }, 2000);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isLive, selectedLevels]);

  /**
   * Scroll when logs change
   */
  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs.length, autoScroll]);

  return (
    <div className="logs-container">
      <div className="logs-header">
        <h1 className="logs-title">日志查看器</h1>
        <div className="logs-actions">
          <div className="live-toggle">
            <label>
              <input
                type="checkbox"
                checked={isLive}
                onChange={toggleLive}
              />
              实时更新
            </label>
          </div>
          <div className="autoscroll-toggle">
            <label>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={() => setAutoScroll(!autoScroll)}
              />
              自动滚动
            </label>
          </div>
          <button className="btn btn-secondary" onClick={refreshLogs} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button className="btn btn-secondary" onClick={clearLogs}>
            清空
          </button>
          <button className="btn btn-primary" onClick={exportLogs} disabled={filteredLogs.length === 0}>
            导出日志
          </button>
        </div>
      </div>

      <div className="logs-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索日志内容..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button className="clear-search" onClick={() => setSearchText('')}>
              ✕
            </button>
          )}
        </div>

        <div className="level-filters">
          <div className="filter-label">级别：</div>
          <div className="level-buttons">
            {LOG_LEVELS.map(level => (
              <button
                key={level.value}
                className={`level-btn ${selectedLevels.has(level.value) ? 'active' : ''}`}
                style={{
                  backgroundColor: selectedLevels.has(level.value) ? level.color : 'transparent',
                  borderColor: level.color,
                  color: selectedLevels.has(level.value) ? 'white' : level.color,
                }}
                onClick={() => toggleLevel(level.value)}
              >
                {level.label}
              </button>
            ))}
          </div>
          <div className="filter-actions">
            <button className="btn btn-sm btn-secondary" onClick={selectAllLevels}>
              全选
            </button>
            <button className="btn btn-sm btn-secondary" onClick={clearAllLevels}>
              清空
            </button>
          </div>
        </div>

        <div className="gateway-actions">
          <button className="btn btn-warning" onClick={handleRestartGateway}>
            重启 Gateway
          </button>
          <button className="btn btn-danger" onClick={handleStopGateway}>
            停止 Gateway
          </button>
        </div>
      </div>

      {error && (
        <div className="logs-error">
          错误: {error}
        </div>
      )}

      <div className="logs-content">
        {filteredLogs.length === 0 && !loading && (
          <div className="no-logs">
            {loading ? '加载中...' : '暂无日志'}
          </div>
        )}
        
        {filteredLogs.map((log, index) => (
          <div
            key={`${log.timestamp}-${index}`}
            className="log-entry"
            style={{ borderLeftColor: getLevelColor(log.level) }}
          >
            <div className="log-meta">
              <span className="log-time">{log.datetime}</span>
              <span
                className="log-level"
                style={{ backgroundColor: getLevelColor(log.level) }}
              >
                {getLevelLabel(log.level)}
              </span>
            </div>
            <div className="log-message">{log.message}</div>
          </div>
        ))}
        
        <div ref={logsEndRef} />
      </div>

      <div className="logs-footer">
        <span className="log-count">
          共 {filteredLogs.length} / {logs.length} 条日志
          {isLive && ' (实时更新)'}
        </span>
      </div>
    </div>
  );
};

export default Logs;
