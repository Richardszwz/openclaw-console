import { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Node,
  Edge,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './Workflow.css';
import WorkflowProperties from './WorkflowProperties';

// 执行历史记录类型
export interface ExecutionHistory {
  id: string;
  startTime: string;
  endTime: string;
  status: 'completed' | 'running' | 'error';
  duration: number;
  currentNode: string;
}

// 节点状态类型
export type NodeStatus = 'pending' | 'running' | 'completed' | 'error';

// 自定义Agent节点
const AgentNode = ({ data }: { data: { label: string; status: NodeStatus } }) => {
  return (
    <div className={`agent-node ${data.status}`}>
      <div className="agent-node-header">
        <span className="agent-icon">🤖</span>
        <span className="agent-name">{data.label}</span>
      </div>
      <div className="agent-node-status">
        <span className={`status-dot ${data.status}`}></span>
        {data.status}
      </div>
    </div>
  );
};

// 自定义审批节点 - 也添加状态支持
const ApprovalNode = ({ data }: { data: { label: string; status?: NodeStatus } }) => {
  const status = data.status || 'pending';
  return (
    <div className={`approval-node ${status}`}>
      <div className="approval-icon">✓</div>
      <div className="approval-label">{data.label}</div>
      <div className="approval-status">
        <span className={`status-dot ${status}`}></span>
      </div>
    </div>
  );
};

// 自定义条件节点 - 也添加状态支持
const ConditionNode = ({ data }: { data: { label: string; status?: NodeStatus } }) => {
  const status = data.status || 'pending';
  return (
    <div className={`condition-node ${status}`}>
      <div className="condition-label">{data.label}</div>
    </div>
  );
};

const nodeTypes = {
  agent: AgentNode,
  approval: ApprovalNode,
  condition: ConditionNode,
};

// 标准六Agent流程
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'agent',
    position: { x: 100, y: 250 },
    data: { label: 'main', status: 'pending' },
  },
  {
    id: '2',
    type: 'agent',
    position: { x: 300, y: 250 },
    data: { label: 'dev-agent', status: 'pending' },
  },
  {
    id: '3',
    type: 'agent',
    position: { x: 500, y: 250 },
    data: { label: 'test-agent', status: 'pending' },
  },
  {
    id: '4',
    type: 'agent',
    position: { x: 700, y: 250 },
    data: { label: 'audit-agent', status: 'pending' },
  },
  {
    id: '5',
    type: 'agent',
    position: { x: 900, y: 250 },
    data: { label: 'data-agent', status: 'pending' },
  },
  {
    id: '6',
    type: 'agent',
    position: { x: 1100, y: 250 },
    data: { label: 'res-agent', status: 'pending' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
  { id: 'e3-4', source: '3', target: '4', animated: true },
  { id: 'e4-5', source: '4', target: '5', animated: true },
  { id: 'e5-6', source: '5', target: '6', animated: true },
];

const Workflow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [activeTab, setActiveTab] = useState<'design' | 'history'>('design');
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<any>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 获取执行历史
  const fetchExecutionHistory = async () => {
    try {
      const response = await fetch('/api/workflows/1/history');
      const result = await response.json();
      if (result.success) {
        setExecutionHistory(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch execution history:', error);
    }
  };

  // 模拟进度更新
  const simulateProgress = () => {
    let currentIndex = 0;
    const nodeIds = nodes.map(n => n.id);
    
    const updateNextNode = () => {
      if (currentIndex > 0) {
        // 将前一个节点标记为完成
        setNodes(nds => nds.map(node => {
          if (node.id === nodeIds[currentIndex - 1]) {
            return { ...node, data: { ...node.data, status: 'completed' } };
          }
          return node;
        }));
      }
      
      if (currentIndex < nodeIds.length) {
        // 将当前节点标记为运行中
        setNodes(nds => nds.map(node => {
          if (node.id === nodeIds[currentIndex]) {
            return { ...node, data: { ...node.data, status: 'running' } };
          }
          return node;
        }));
        currentIndex++;
      } else {
        // 所有节点完成
        setIsRunning(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        fetchExecutionHistory();
      }
    };

    // 模拟进度
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(updateNextNode, 3000); // 每3秒更新一次，总共15秒完成
    updateNextNode();
  };

  // 开始执行
  const startExecution = async () => {
    // 重置所有节点状态
    setNodes(nds => nds.map(node => ({ ...node, data: { ...node.data, status: 'pending' } })));
    
    const newExecution: ExecutionHistory = {
      id: `exec-${Date.now()}`,
      startTime: new Date().toISOString(),
      endTime: '',
      status: 'running',
      duration: 0,
      currentNode: nodes[0]?.id || ''
    };
    
    setIsRunning(true);
    
    // 添加到历史记录
    setExecutionHistory(prev => [newExecution, ...prev]);
    
    // 开始模拟进度
    simulateProgress();
  };

  // 实时轮询
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning) {
      // 每5秒轮询一次更新状态
      interval = setInterval(() => {
        // 在模拟环境中，更新已经在simulateProgress中处理
        // 这里可以添加实际API调用逻辑
        console.log('Polling workflow status...');
      }, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  // 组件加载时获取历史
  useEffect(() => {
    fetchExecutionHistory();
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow/type');
      const label = event.dataTransfer.getData('application/reactflow/label');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstanceRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { 
          label, 
          status: 'idle',
          description: '',
          config: {}
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const updateNodeData = (id: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          const updatedNode = { ...node, data: { ...node.data, ...newData } };
          if (selectedNode?.id === id) {
            setSelectedNode(updatedNode);
          }
          return updatedNode;
        }
        return node;
      })
    );
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'My Workflow',
          nodes,
          edges,
        }),
      });
      const result = await response.json();
      console.log('Workflow saved:', result);
      alert('Workflow saved successfully!');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('Failed to save workflow');
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleString('zh-CN');
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'running': return 'status-badge running';
      case 'completed': return 'status-badge completed';
      case 'error': return 'status-badge error';
      default: return 'status-badge pending';
    }
  };

  return (
    <div className="workflow-container">
      <div className="workflow-header">
        <h1>Workflow Studio</h1>
        <p>Design and visualize your agent workflow</p>
        <button className="save-btn" onClick={handleSave}>
          💾 Save Workflow
        </button>
        {!isRunning ? (
          <button className="run-btn" onClick={startExecution}>
            ▶️ Run Workflow
          </button>
        ) : (
          <button className="stop-btn" disabled>
            ⏸️ Running...
          </button>
        )}
      </div>
      <div className="workflow-tabs">
        <button 
          className={`tab ${activeTab === 'design' ? 'active' : ''}`}
          onClick={() => setActiveTab('design')}
        >
          Design
        </button>
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('history');
            fetchExecutionHistory();
          }}
        >
          History ({executionHistory.length})
        </button>
      </div>
      {activeTab === 'design' ? (
        <div className="workflow-content">
          <div className="node-panel">
            <h3>Nodes</h3>
            <div
              className="node-item"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/reactflow/type', 'agent');
                event.dataTransfer.setData('application/reactflow/label', 'Agent');
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
              <span className="node-icon">🤖</span>
              <span>Agent</span>
            </div>
            <div
              className="node-item"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/reactflow/type', 'approval');
                event.dataTransfer.setData('application/reactflow/label', 'Approval');
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
              <span className="node-icon">✓</span>
              <span>Approval</span>
            </div>
            <div
              className="node-item"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/reactflow/type', 'condition');
                event.dataTransfer.setData('application/reactflow/label', 'Condition');
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
              <span className="node-icon">❓</span>
              <span>Condition</span>
            </div>
          </div>
          <div className="reactflow-wrapper" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onInit={(instance) => {
                reactFlowInstanceRef.current = instance;
              }}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
          {selectedNode && (
            <WorkflowProperties node={selectedNode} onUpdate={updateNodeData} />
          )}
        </div>
      ) : (
        <div className="history-container">
          <h2>Execution History</h2>
          {executionHistory.length === 0 ? (
            <div className="empty-history">
              <p>No execution history yet. Run the workflow to see history.</p>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Execution ID</th>
                  <th>Start Time</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Last Node</th>
                </tr>
              </thead>
              <tbody>
                {executionHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id.slice(0, 10)}...</td>
                    <td>{formatTime(item.startTime)}</td>
                    <td>
                      <span className={getStatusBadgeClass(item.status)}>
                        {item.status}
                      </span>
                    </td>
                    <td>{item.duration > 0 ? formatDuration(item.duration) : '-'}</td>
                    <td>{item.currentNode || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

const WorkflowWithProvider = () => (
  <ReactFlowProvider>
    <Workflow />
  </ReactFlowProvider>
);

export default WorkflowWithProvider;
