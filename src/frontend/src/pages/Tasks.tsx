/**
 * @fileoverview Tasks page - shows list of cron tasks and execution history
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import { useState, useEffect } from 'react';
import './Tasks.css';

/**
 * Task interface matching backend API
 */
interface CronTask {
  id: string;
  name: string;
  cron: string;
  command: string;
  enabled: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
  nextRun: string | null;
}

/**
 * Execution history interface
 */
interface TaskExecution {
  id: string;
  taskId: string;
  startTime: string;
  endTime: string;
  status: 'success' | 'failed' | 'running';
  duration: number;
  output?: string;
  error?: string;
}

/**
 * Tasks page component
 */
function Tasks() {
  const [tasks, setTasks] = useState<CronTask[]>([]);
  const [history, setHistory] = useState<TaskExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  /**
   * Fetch tasks from API
   */
  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks', {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_API_TOKEN || ''}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTasks(data.tasks);
      setError(null);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  /**
   * Fetch execution history
   */
  const fetchHistory = async (taskId?: string) => {
    try {
      let url = '/api/tasks/history';
      if (taskId) {
        url = `/api/tasks/${taskId}/history`;
      }
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_API_TOKEN || ''}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setHistory(data.history);
      setError(null);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  /**
   * Load data on mount
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTasks(), fetchHistory()]);
      setLoading(false);
    };
    loadData();
  }, []);

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  /**
   * Format duration for display
   */
  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  /**
   * Get relative time description
   */
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) {
      return '已过期';
    }
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 60) {
      return `${minutes}分钟后`;
    }
    if (hours < 24) {
      return `${hours}小时后`;
    }
    return `${days}天后`;
  };

  /**
   * Handle task row click
   */
  const handleTaskClick = (taskId: string) => {
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
      fetchHistory();
    } else {
      setSelectedTaskId(taskId);
      fetchHistory(taskId);
    }
  };

  /**
   * Get last execution status for a task
   */
  const getLastExecutionStatus = (taskId: string) => {
    const taskHistory = history.filter(h => h.taskId === taskId);
    if (taskHistory.length === 0) {
      return null;
    }
    return taskHistory[0].status;
  };

  if (loading) {
    return (
      <div className="tasks-container">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="tasks-container">
      <div className="tasks-header">
        <h1>定时任务</h1>
        <button
          className="add-task-btn"
          onClick={() => {
            // TODO: Navigate to task editor
            console.log('Open task editor');
          }}
        >
          添加任务
        </button>
      </div>

      {error && (
        <div className="error-message">
          错误: {error}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="no-tasks">
          <p>暂无定时任务配置</p>
          <p>点击"添加任务"创建第一个定时任务</p>
        </div>
      ) : (
        <table className="tasks-table">
          <thead>
            <tr>
              <th>状态</th>
              <th>任务名称</th>
              <th>Cron 表达式</th>
              <th>下次执行</th>
              <th>最后执行状态</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => {
              const lastStatus = getLastExecutionStatus(task.id);
              const isSelected = selectedTaskId === task.id;
              return (
                <tr
                  key={task.id}
                  onClick={() => handleTaskClick(task.id)}
                  style={{ cursor: 'pointer', backgroundColor: isSelected ? 'var(--row-hover-bg)' : undefined }}
                >
                  <td>
                    <span className={`status-badge ${task.enabled ? 'status-enabled' : 'status-disabled'}`}>
                      {task.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td>
                    <div className="task-name">{task.name}</div>
                    {task.description && (
                      <div className="task-description">{task.description}</div>
                    )}
                  </td>
                  <td>
                    <code className="cron-expression">{task.cron}</code>
                  </td>
                  <td>
                    {task.nextRun ? (
                      <div>
                        <div className={new Date(task.nextRun).getTime() - Date.now() < 3600000 ? 'next-run-soon' : 'next-run-later'}>
                          {getRelativeTime(task.nextRun)}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {formatDate(task.nextRun)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>-</span>
                    )}
                  </td>
                  <td>
                    {lastStatus ? (
                      <span className={`status-badge status-${lastStatus}`}>
                        {lastStatus === 'success' ? '成功' : lastStatus === 'failed' ? '失败' : '运行中'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>未执行</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {history.length > 0 && (
        <div className="history-section">
          <h2>
            {selectedTaskId ? '任务执行历史' : '所有执行历史'}
          </h2>
          <table className="history-table">
            <thead>
              <tr>
                <th>任务</th>
                <th>开始时间</th>
                <th>状态</th>
                <th>耗时</th>
                <th>输出</th>
              </tr>
            </thead>
            <tbody>
              {history.map(execution => {
                const task = tasks.find(t => t.id === execution.taskId);
                return (
                  <tr key={execution.id}>
                    <td>{task ? task.name : execution.taskId}</td>
                    <td>{formatDate(execution.startTime)}</td>
                    <td>
                      <span className={`status-badge status-${execution.status}`}>
                        {execution.status === 'success' ? '成功' : execution.status === 'failed' ? '失败' : '运行中'}
                      </span>
                    </td>
                    <td>
                      <span className="duration">{formatDuration(execution.duration)}</span>
                    </td>
                    <td>
                      {execution.output ? (
                        <div className="execution-output" title={execution.output}>
                          {execution.output}
                        </div>
                      ) : execution.error ? (
                        <div className="execution-output" style={{ color: '#a01111' }} title={execution.error}>
                          {execution.error}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Tasks;
