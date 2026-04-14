import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Logs from './pages/Logs';
import Agents from './pages/Agents';
import AgentDetail from './pages/AgentDetail';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import Workflow from './pages/Workflow';
import Tasks from './pages/Tasks';
import TaskEditor from './pages/TaskEditor';
import Models from './pages/Models';
import './App.css';

type Page = 'dashboard' | 'logs' | 'agents' | 'agent-detail' | 'sessions' | 'session-detail' | 'workflow' | 'tasks' | 'task-editor' | 'models';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);

  /**
   * Restart the server
   */
  const handleRestartServer = async () => {
    try {
      setRestarting(true);
      const response = await fetch('/api/server/restart', {
        method: 'POST',
      });
      const data = await response.json();

      if (response.ok && data.status === 'ok') {
        alert('服务重启已发起，请等待几秒钟后刷新页面');
        // Wait a few seconds then reload the page
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      } else {
        alert(`重启失败: ${data.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Failed to restart server:', error);
      alert('重启请求发送失败，请检查网络连接');
    } finally {
      setRestarting(false);
    }
  };

  /**
   * Navigate to agent detail page
   */
  const navigateToAgentDetail = (agentId: string) => {
    setSelectedAgentId(agentId);
    setCurrentPage('agent-detail');
  };

  /**
   * Go back to agents list from detail page
   */
  const goBackToAgents = () => {
    setCurrentPage('agents');
    setSelectedAgentId('');
  };

  /**
   * Navigate to session detail page
   */
  const navigateToSessionDetail = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setCurrentPage('session-detail');
  };

  /**
   * Go back to sessions list from detail page
   */
  const goBackToSessions = () => {
    setCurrentPage('sessions');
    setSelectedSessionId('');
  };

  return (
    <div className="app-container">
      {/* Header - 64px according to prototype */}
      <header className="header">
        <div className="header-left">
          <button 
            className="menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="切换菜单"
          >
            ☰
          </button>
          <div className="logo">
            <span>⚙️</span>
            <span>OpenClaw Console</span>
          </div>
        </div>
        <div className="header-right">
          <span 
            className={`header-icon ${restarting ? 'opacity-50 cursor-not-allowed' : ''}`} 
            onClick={restarting ? undefined : handleRestartServer}
            title="重启OpenClaw Console服务"
          >
            {restarting ? '⏳' : '🔄'}
          </span>
          <span className="header-icon" title="通知">🔔</span>
          <span className="header-icon" title="管理员">👤</span>
          <span className="header-icon" title="设置">⚙️</span>
        </div>
      </header>

      {/* Main container with Sidebar and Content */}
      <div className="main-container">
        {/* Sidebar - 200px according to prototype */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav className="sidebar-menu">
            <div 
              className={`sidebar-item ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentPage('dashboard')}
            >
              <span className="icon">📊</span>
              <span>仪表盘</span>
            </div>
            
            <div className="sidebar-item">
              <span className="icon">🌐</span>
              <span>网关监控</span>
            </div>
            <div className="sidebar-submenu">
              <div 
                className={`sidebar-subitem ${currentPage === 'logs' ? 'active' : ''}`}
                onClick={() => setCurrentPage('logs')}
              >
                日志中心
              </div>
            </div>

            <div className={`sidebar-item ${currentPage === 'agents' || currentPage === 'agent-detail' ? 'active' : ''}`}>
              <span className="icon">🤖</span>
              <span>Agent舰队</span>
            </div>
            <div className="sidebar-submenu">
              <div 
                className={`sidebar-subitem ${currentPage === 'agents' || currentPage === 'agent-detail' ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage('agents');
                  setSelectedAgentId('');
                }}
              >
                Agent列表
              </div>
            </div>

            <div className={`sidebar-item ${currentPage === 'sessions' || currentPage === 'session-detail' ? 'active' : ''}`}>
              <span className="icon">💬</span>
              <span>会话管理</span>
            </div>
            <div className="sidebar-submenu">
              <div 
                className={`sidebar-subitem ${currentPage === 'sessions' || currentPage === 'session-detail' ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage('sessions');
                  setSelectedSessionId('');
                }}
              >
                会话列表
              </div>
            </div>

            <div className={`sidebar-item ${currentPage === 'workflow' ? 'active' : ''}`}>
              <span className="icon">🔄</span>
              <span>工作流</span>
            </div>
            <div className="sidebar-submenu">
              <div 
                className={`sidebar-subitem ${currentPage === 'workflow' ? 'active' : ''}`}
                onClick={() => setCurrentPage('workflow')}
              >
                流程列表
              </div>
            </div>

            <div className={`sidebar-item ${currentPage === 'tasks' || currentPage === 'task-editor' ? 'active' : ''}`}>
              <span className="icon">⏰</span>
              <span>任务调度</span>
            </div>
            <div className="sidebar-submenu">
              <div 
                className={`sidebar-subitem ${currentPage === 'tasks' || currentPage === 'task-editor' ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage('tasks');
                }}
              >
                定时任务
              </div>
            </div>

            <div className={`sidebar-item ${currentPage === 'models' ? 'active' : ''}`}>
              <span className="icon">🤖</span>
              <span>模型管理</span>
            </div>
            <div className="sidebar-submenu">
              <div 
                className={`sidebar-subitem ${currentPage === 'models' ? 'active' : ''}`}
                onClick={() => setCurrentPage('models')}
              >
                模型配置
              </div>
            </div>

            <div className="sidebar-item">
              <span className="icon">⚙️</span>
              <span>系统设置</span>
            </div>
          </nav>
        </aside>

        {/* Main Content - adaptive width according to prototype */}
        <main 
          className="content"
          onClick={() => {
            // Close sidebar when clicking content on mobile
            if (window.innerWidth <= 768 && sidebarOpen) {
              setSidebarOpen(false);
            }
          }}
        >
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'logs' && <Logs />}
          {currentPage === 'agents' && <Agents onAgentClick={navigateToAgentDetail} />}
          {currentPage === 'agent-detail' && selectedAgentId && (
            <AgentDetail agentId={selectedAgentId} onBack={goBackToAgents} />
          )}
          {currentPage === 'sessions' && <Sessions onSessionClick={navigateToSessionDetail} />}
          {currentPage === 'session-detail' && selectedSessionId && (
            <SessionDetail sessionId={selectedSessionId} onBack={goBackToSessions} />
          )}
          {currentPage === 'workflow' && <Workflow />}
          {currentPage === 'tasks' && <Tasks />}
          {currentPage === 'task-editor' && (
            <TaskEditor onBack={() => setCurrentPage('tasks')} />
          )}
          {currentPage === 'models' && <Models />}
        </main>
      </div>
    </div>
  );
}

export default App;
