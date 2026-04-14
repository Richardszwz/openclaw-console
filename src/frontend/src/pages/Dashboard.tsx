/**
 * @fileoverview Gateway Status Dashboard page
 * Displays Gateway runtime status, performance metrics and channel information
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import './Dashboard.css';

/**
 * Gateway status interface matching backend API
 */
interface GatewayStatus {
  status: 'online' | 'offline' | 'error';
  version?: string;
  startTime?: string;
  uptime?: number;
  uptimeHuman?: string;
  memory?: {
    used: number;
    total: number;
    percent: number;
  };
  connections?: number;
  channels?: ChannelInfo[];
  error?: string;
}

/**
 * Channel information interface
 */
interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  lastActive?: string;
}

/**
 * History point for charts
 */
interface HistoryPoint {
  time: string;
  memory: number;
  connections: number;
}

/**
 * Agent statistics interface
 */
interface AgentStats {
  total: number;
  active: number;
  idle: number;
}

/**
 * Skill information interface
 */
interface SkillInfo {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
}

/**
 * Skills response interface
 */
interface SkillsResponse {
  skills: SkillInfo[];
  total: number;
  enabledCount: number;
}

/**
 * Log entry interface
 */
interface LogEntry {
  timestamp: number;
  datetime: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'trace';
  message: string;
}

/**
 * Gateway Status Dashboard Component
 */
const Dashboard: React.FC = () => {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Additional dashboard data
  const [agentStats, setAgentStats] = useState<AgentStats>({ total: 0, active: 0, idle: 0 });
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [skillsStats, setSkillsStats] = useState({ total: 0, enabledCount: 0 });
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [systemInfo, setSystemInfo] = useState({ platform: '', nodeVersion: '', uptime: 0 });

  /**
   * Fetch gateway status from API
   */
  const fetchStatus = async () => {
    try {
      const apiToken = import.meta.env.VITE_API_TOKEN;
      const headers: HeadersInit = {};
      
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }
      
      const response = await fetch('/api/gateway/status', { headers });
      const data = await response.json();
      setStatus(data);
      setError(null);

      // Add to history for chart
      if (data.status === 'online' && data.memory) {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        setHistory(prev => {
          const newHistory = [...prev, {
            time: timeStr,
            memory: data.memory?.percent || 0,
            connections: data.connections || 0,
          }];
          // Keep last 20 data points
          return newHistory.slice(-20);
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch all dashboard data
   */
  const fetchDashboardData = async () => {
    const apiToken = import.meta.env.VITE_API_TOKEN;
    const headers: HeadersInit = {};
    
    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }

    try {
      // Fetch agent stats
      const agentsRes = await fetch('/api/agents', { headers });
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        const agents = agentsData.agents || [];
        setAgentStats({
          total: agents.length,
          active: agents.filter((a: any) => a.status === 'active').length,
          idle: agents.filter((a: any) => a.status === 'idle').length,
        });
      }

      // Fetch skills
      const skillsRes = await fetch('/api/skills', { headers });
      if (skillsRes.ok) {
        const skillsData: SkillsResponse = await skillsRes.json();
        setSkills(skillsData.skills.slice(0, 10)); // Show top 10
        setSkillsStats({
          total: skillsData.total,
          enabledCount: skillsData.enabledCount,
        });
      }

      // Fetch recent logs
      const logsRes = await fetch('/api/logs/tail?lines=5', { headers });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setRecentLogs(logsData.entries || []);
      }

      // Get system info
      const sysRes = await fetch('/api/status', { headers });
      if (sysRes.ok) {
        // We can get basic system info from process
        setSystemInfo({
          platform: navigator.platform,
          nodeVersion: process?.versions?.node || 'Unknown',
          uptime: process?.uptime ? Math.round(process.uptime()) : 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    }
  };

  /**
   * Initial fetch and auto-refresh
   */
  useEffect(() => {
    fetchStatus();
    fetchDashboardData();
    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetchStatus();
      fetchDashboardData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Get status badge color
   */
  const getStatusColor = (s: string): string => {
    switch (s) {
      case 'online':
      case 'connected':
        return '#10b981';
      case 'offline':
      case 'disconnected':
        return '#6b7280';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  /**
   * Get status label in Chinese
   */
  const getStatusLabel = (s: string): string => {
    switch (s) {
      case 'online':
        return '在线';
      case 'offline':
        return '离线';
      case 'error':
        return '错误';
      case 'connected':
        return '已连接';
      case 'disconnected':
        return '未连接';
      default:
        return s;
    }
  };

  /**
   * Memory usage chart option
   */
  const getMemoryChartOption = () => {
    const xData = history.map(p => p.time);
    const memoryData = history.map(p => p.memory);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: '{b}: {c}%',
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLabel: {
          rotate: 45,
        },
      },
      yAxis: {
        type: 'value',
        max: 100,
        name: '使用率 (%)',
      },
      series: [{
        name: '内存使用率',
        data: memoryData,
        type: 'line',
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: 'rgba(66, 153, 225, 0.6)',
            }, {
              offset: 1, color: 'rgba(66, 153, 225, 0.1)',
            }],
          },
        },
        lineStyle: {
          color: '#4299e1',
        },
      }],
      grid: {
        left: '10%',
        right: '5%',
        bottom: '15%',
        top: '10%',
      },
    };
  };

  /**
   * Connections chart option
   */
  const getConnectionsChartOption = () => {
    const xData = history.map(p => p.time);
    const connectionData = history.map(p => p.connections);

    return {
      tooltip: {
        trigger: 'axis',
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLabel: {
          rotate: 45,
        },
      },
      yAxis: {
        type: 'value',
        name: '连接数',
        minInterval: 1,
      },
      series: [{
        name: '活跃连接',
        data: connectionData,
        type: 'bar',
        itemStyle: {
          color: '#8b5cf6',
        },
      }],
      grid: {
        left: '10%',
        right: '5%',
        bottom: '15%',
        top: '10%',
      },
    };
  };

  if (loading && !status) {
    return <div className="dashboard-loading">加载中...</div>;
  }

  if (error && !status) {
    return <div className="dashboard-error">错误: {error}</div>;
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Gateway 状态监控</h1>

      {/* Gateway Overview Card */}
      <div className="card gateway-overview">
        <div className="card-header">
          <h2>Gateway 概览</h2>
          <span 
            className="status-badge"
            style={{ backgroundColor: getStatusColor(status?.status || 'offline') }}
          >
            {getStatusLabel(status?.status || 'offline')}
          </span>
        </div>
        <div className="overview-grid">
          <div className="overview-item">
            <label>版本</label>
            <span className="value">{status?.version || '未知'}</span>
          </div>
          <div className="overview-item">
            <label>运行时长</label>
            <span className="value">{status?.uptimeHuman || 'N/A'}</span>
          </div>
          <div className="overview-item">
            <label>内存使用</label>
            <span className="value">
              {status?.memory ? `${status.memory.used} MB / ${status.memory.percent}%` : 'N/A'}
            </span>
          </div>
          <div className="overview-item">
            <label>活跃连接</label>
            <span className="value">{status?.connections ?? 'N/A'}</span>
          </div>
        </div>
        {status?.error && (
          <div className="error-message">
            {status.error}
          </div>
        )}
      </div>

      {/* Performance Charts */}
      <div className="charts-grid">
        <div className="card chart-card">
          <h3>内存使用率历史</h3>
          <ReactECharts 
            option={getMemoryChartOption()} 
            style={{ height: '300px', width: '100%' }}
          />
        </div>
        <div className="card chart-card">
          <h3>连接数历史</h3>
          <ReactECharts 
            option={getConnectionsChartOption()} 
            style={{ height: '300px', width: '100%' }}
          />
        </div>
      </div>

      {/* Channels Status */}
      <div className="card channels-section">
        <h2>渠道状态</h2>
        <div className="channels-grid">
          {(status?.channels || []).map(channel => (
            <div key={channel.id} className="channel-card">
              <div className="channel-header">
                <span className="channel-name">{channel.name}</span>
                <span 
                  className="status-badge small"
                  style={{ backgroundColor: getStatusColor(channel.status) }}
                >
                  {getStatusLabel(channel.status)}
                </span>
              </div>
              <div className="channel-info">
                <div className="channel-type">类型: {channel.type}</div>
                {channel.lastActive && (
                  <div className="channel-last-active">最近活动: {channel.lastActive}</div>
                )}
              </div>
            </div>
          ))}
          {(!status?.channels || status.channels.length === 0) && (
            <div className="no-channels">暂无渠道信息</div>
          )}
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="card stats-section">
        <h2>系统统计</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{agentStats.total}</div>
            <div className="stat-label">Total Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{agentStats.active}</div>
            <div className="stat-label">Active Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{skillsStats.enabledCount}</div>
            <div className="stat-label">Enabled Skills</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{skillsStats.total}</div>
            <div className="stat-label">Installed Skills</div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="card system-section">
        <h2>系统信息</h2>
        <div className="system-info-grid">
          <div className="system-info-item">
            <label>Gateway Status</label>
            <span className="value" style={{ color: getStatusColor(status?.status || 'offline') }}>
              {getStatusLabel(status?.status || 'offline')}
            </span>
          </div>
          <div className="system-info-item">
            <label>Gateway Version</label>
            <span className="value">{status?.version || 'Unknown'}</span>
          </div>
          <div className="system-info-item">
            <label>Platform</label>
            <span className="value">{systemInfo.platform || 'Unknown'}</span>
          </div>
          <div className="system-info-item">
            <label>Node Version</label>
            <span className="value">{systemInfo.nodeVersion || 'Unknown'}</span>
          </div>
          {status?.memory && (
            <div className="system-info-item">
              <label>Memory Usage</label>
              <span className="value">{status.memory.used} MB / {status.memory.percent}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Top Skills */}
      <div className="card skills-section">
        <h2>已安装技能 (Top 10)</h2>
        <div className="skills-list">
          {skills.length === 0 ? (
            <div className="no-skills">暂无技能信息</div>
          ) : (
            skills.map(skill => (
              <div key={skill.id} className="skill-item">
                <div className="skill-info">
                  <span className="skill-name">{skill.name}</span>
                  {skill.description && (
                    <span className="skill-description">{skill.description}</span>
                  )}
                </div>
                <span 
                  className="status-badge small"
                  style={{ 
                    backgroundColor: skill.enabled ? getStatusColor('connected') : getStatusColor('disconnected'),
                    fontSize: '12px'
                  }}
                >
                  {skill.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Logs */}
      <div className="card logs-section">
        <h2>最近日志</h2>
        <div className="logs-list">
          {recentLogs.length === 0 ? (
            <div className="no-logs">暂无日志</div>
          ) : (
            recentLogs.map((log, index) => (
              <div key={index} className={`log-item level-${log.level}`}>
                <span className="log-time">{log.datetime}</span>
                <span className={`log-level badge-${log.level}`}>{log.level}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
