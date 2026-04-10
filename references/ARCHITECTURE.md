# 技术架构设计

## 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw Console                         │
│                      (Web UI)                               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Gateway  │  │  Agent   │  │ Session  │  │  Task    │  │
│  │   Hub    │  │  Fleet   │  │ Manager  │  │Scheduler │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐                                 │
│  │ Workflow │  │ Settings │                                 │
│  │  Studio  │  │  Center  │                                 │
│  └──────────┘  └──────────┘                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ WebSocket / HTTP
┌─────────────────────────────────────────────────────────────┐
│              OpenClaw Console Server                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  API     │  │ WebSocket│  │  Data    │  │  Config  │  │
│  │ Gateway  │  │  Server  │  │ Service  │  │ Manager  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ OpenClaw     │   │   SQLite     │   │   File       │
│ Gateway      │   │   Database   │   │   System     │
│ (Port 18789) │   │              │   │ (~/.openclaw)│
└──────────────┘   └──────────────┘   └──────────────┘
```

## 模块详细设计

### 1. Gateway Hub 模块

**职责**: 监控和管理 OpenClaw Gateway

**API 接口**:
```typescript
interface GatewayAPI {
  // 获取状态
  getStatus(): Promise<GatewayStatus>;
  
  // 启停控制
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  
  // 日志管理
  getLogs(options: LogOptions): Promise<LogEntry[]>;
  streamLogs(callback: (log: LogEntry) => void): void;
  
  // 性能指标
  getMetrics(timeRange: TimeRange): Promise<MetricsData>;
}
```

**数据结构**:
```typescript
interface GatewayStatus {
  running: boolean;
  pid: number;
  port: number;
  uptime: number;
  version: string;
  connectedChannels: string[];
  activeSessions: number;
}
```

### 2. Agent Fleet 模块

**职责**: 管理 10 个 AI Agent

**核心功能**:
- 从 openclaw.json 读取配置
- 显示每个 Agent 的状态
- 支持启停和配置修改

**数据结构**:
```typescript
interface Agent {
  id: string;
  name: string;
  workspace: string;
  model: string;
  skills: string[];
  status: 'running' | 'stopped' | 'error';
  lastActivity: Date;
  memoryUsage: number;
}
```

### 3. Session Manager 模块

**职责**: 管理所有会话

**核心功能**:
- 从 Gateway API 获取会话列表
- 实时更新会话状态
- 支持 Kill/Delete 操作

**数据结构**:
```typescript
interface Session {
  id: string;
  agentId: string;
  channel: string;
  status: 'running' | 'done' | 'failed' | 'killed';
  startedAt: Date;
  updatedAt: Date;
  contextTokens: number;
  model: string;
}
```

### 4. Workflow Studio 模块

**职责**: 可视化工作流设计

**核心功能**:
- 六/十 Agent 标准流程模板
- 拖拽式流程设计器
- 实时任务流转显示

**数据结构**:
```typescript
interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: 'draft' | 'active' | 'paused';
}

interface WorkflowNode {
  id: string;
  type: 'agent' | 'approval' | 'condition' | 'end';
  agentId?: string;
  position: { x: number; y: number };
}
```

### 5. Task Scheduler 模块

**职责**: 管理定时任务

**核心功能**:
- 读取 cron 配置
- 可视化编辑定时任务
- 执行历史和告警

**数据结构**:
```typescript
interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  lastRun: Date;
  nextRun: Date;
  status: 'ok' | 'late' | 'failed';
}
```

### 6. Model Usage Dashboard 模块

**职责**: 多平台模型用量监控和总量预警

**核心功能**:
- 对接不同平台模型 API 获取用量统计
- 实时显示当前周期用量
- 显示月/日使用量趋势图
- 用量阈值预警
- 成本估算

**支持平台**:
- Volcengine (Doubao)
- MiniMax
- OpenAI
- Anthropic
- Google Gemini
- 任何其他配置在 openclaw.json 中的模型

**数据结构**:
```typescript
interface ModelConfig {
  id: string;
  name: string;
  provider: 'volcengine' | 'minimax' | 'openai' | 'anthropic' | 'google' | 'other';
  apiKey: string;
  monthlyQuota?: number;  // 月度总量配额
  dailyQuota?: number;    // 日额度
  pricePerMillionTokens: number;  // 价格（每百万 tokens）
  enabled: boolean;
}

interface ModelUsage {
  modelId: string;
  date: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEstimate: number;  // 估算成本
}

interface UsageAlert {
  modelId: string;
  threshold: number;  // 预警阈值（百分比，如 80 表示 80%
  triggered: boolean;
  lastTriggered?: Date;
}
```

## 数据库设计

### SQLite Schema

```sql
-- 系统配置
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent 状态历史
CREATE TABLE agent_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT,
  status TEXT,
  memory_usage INTEGER,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 会话事件
CREATE TABLE session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  event_type TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 任务执行记录
CREATE TABLE task_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT,
  status TEXT,
  output TEXT,
  started_at DATETIME,
  ended_at DATETIME
);

-- 告警记录
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT,
  message TEXT,
  source TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 模型配置
CREATE TABLE model_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT UNIQUE,
  name TEXT,
  provider TEXT,
  api_key TEXT,
  monthly_quota INTEGER,
  daily_quota INTEGER,
  price_per_million REAL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 模型用量每日统计
CREATE TABLE model_usage_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT,
  usage_date DATE,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_estimate REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用量预警配置
CREATE TABLE model_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT,
  threshold_percent INTEGER,
  triggered BOOLEAN DEFAULT FALSE,
  last_triggered DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 实时通信设计

### WebSocket 事件

```typescript
// 服务端 → 客户端
interface ServerEvents {
  'gateway:status': GatewayStatus;
  'gateway:log': LogEntry;
  'agent:update': Agent;
  'session:update': Session;
  'task:complete': TaskExecution;
  'alert:new': Alert;
  'model:usage-update': ModelUsage[];
  'model:quota-alert': { modelId: string; usagePercent: number };
}

// 客户端 → 服务端
interface ClientEvents {
  'gateway:command': { action: 'start' | 'stop' | 'restart' };
  'session:kill': { sessionId: string };
  'session:delete': { sessionId: string };
  'agent:restart': { agentId: string };
  'task:trigger': { taskId: string };
  'model:fetch-usage': { modelId: string };
  'model:update-config': ModelConfig;
}
```

## 安全设计

1. **本地访问**: 默认只允许 localhost 访问
2. **Token 认证**: 复用 OpenClaw Gateway 的 token
3. **操作审计**: 记录所有管理操作
4. **只读模式**: 支持只读监控模式

## 性能优化

1. **虚拟列表**: 会话列表使用虚拟滚动
2. **增量更新**: WebSocket 推送增量数据
3. **数据缓存**: 前端缓存配置数据
4. **懒加载**: 按需加载历史数据

---

## OpenClaw Skill 打包设计

### 目录结构（符合 OpenClaw Skill 规范）

```
skills/openclaw-console/
├── SKILL.md              # Skill 描述文档
├── package.json          # npm 依赖
├── openclaw-skill.json   # Skill 元数据
├── src/
│   ├── server/           # Node.js 后端
│   │   ├── index.ts
│   │   ├── api/
│   │   └── services/
│   └── frontend/        # React 前端编译产物
│       ├── dist/
│       └── assets/
├── scripts/
│   ├── install.ps1
│   ├── start.ps1
│   └── build.ps1
├── db/                  # SQLite 数据库
└── logs/               # 运行日志
```

### 安装流程

用户只需一条命令安装：
```
openclaw skills install openclaw-console
```

安装脚本自动完成：
1. 克隆代码仓库
2. 安装后端依赖
3. 前端已预编译（无需用户本地安装 Node.js 编译）
4. 配置端口（默认 4310，可配置）
5. 自动创建快捷命令 `openclaw-console start`

### 卸载流程

```
openclaw skills uninstall openclaw-console
```

自动删除：
- 代码目录
- 数据库文件（可选保留）
- 快捷命令

### 启动集成

安装后自动注册到 OpenClaw 配置：
```json
{
  "skills": {
    "openclaw-console": {
      "enabled": true,
      "port": 4310,
      "autoStart": false,
      "bind": "localhost",
      "databasePath": "~/.openclaw/data/console.db"
    }
  }
}
```

### 启动方式

通过 OpenClaw CLI：
```bash
# 启动控制台
openclaw console start

# 停止控制台
openclaw console stop

# 重启控制台
openclaw console restart

# 查看状态
openclaw console status
```

### Data Persistence

- 数据库位置：`~/.openclaw/data/console.db`
- 用户数据独立于代码，升级不丢失
- 备份时自动包含在 OpenClaw 备份中

### 版本管理

符合 ClawHub 规范：
- `major.minor.patch` 语义化版本
- 支持 `openclaw skills upgrade openclaw-console`
- 支持回滚到指定版本

---

## 可移植性设计

### 跨平台支持

| 操作系统 | 支持 | 说明 |
|----------|------|------|
| Windows | ✅ | PowerShell 脚本 |
| Linux | ✅ | Bash 脚本 |
| macOS | ✅ | Bash 脚本 |

### 依赖管理

- **核心依赖**: Node.js 20+ (OpenClaw 已自带)
- **数据库**: SQLite (零配置)
- **无外部依赖**: 不要求用户安装 Docker 等额外工具
- **自包含**: 前端预编译，用户无需前端构建环境

### 配置隔离

- Skill 配置存储在 OpenClaw 用户目录
- 代码和数据分离
- 多 OpenClaw 实例可独立安装
- 不影响其他 Skill
