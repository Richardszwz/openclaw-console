# OpenClaw Console 安装部署手册

## 目录
- [环境要求](#环境要求)
- [一键安装](#一键安装)
- [手动安装](#手动安装)
- [配置说明](#配置说明)
- [开机自启配置](#开机自启配置)

---

## 环境要求

### 必须组件

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | 20.0.0 或更高 | OpenClaw 已自带，通常无需额外安装 |
| OpenClaw | v0.15.0 或更高 | 必须先安装 OpenClaw 核心系统 |
| 操作系统 | Windows 10+/Linux/macOS | 全平台支持 |

### 推荐配置

- **内存**: 至少 1GB 可用内存
- **磁盘**: 至少 500MB 可用磁盘空间
- **浏览器**: Chrome/Edge/Firefox/Safari 最新版本

### 检查环境

安装前请确认环境：

```bash
# 检查 Node.js 版本
node --version
# 输出版本应 >= v20.0.0

# 检查 OpenClaw 版本
openclaw --version
# 输出版本应 >= v0.15.0
```

---

## 一键安装

OpenClaw Console 作为标准 OpenClaw Skill 发布，可以通过 ClawHub 一键安装。

### 所有平台 (推荐)

```bash
openclaw skills install openclaw/openclaw-console
```

这条命令会自动完成以下操作：
1. 从 ClawHub 下载最新版本
2. 安装所有依赖包
3. 预编译前端资源
4. 注册 `openclaw console` 命令
5. 创建默认配置

### 安装完成后的验证

```bash
# 检查是否安装成功
openclaw console --help

# 预期输出：
# Usage: openclaw console [command]
#
# Commands:
#   start     Start OpenClaw Console
#   stop      Stop OpenClaw Console
#   restart   Restart OpenClaw Console
#   status    Show status
#   help      Show help
```

---

## 手动安装

如果你想要自定义安装位置或者从源代码安装，请按照以下步骤操作。

### 步骤 1: 克隆代码

```bash
cd ~/.openclaw/workspace
git clone https://github.com/openclaw/openclaw-console.git
cd openclaw-console
```

### 步骤 2: 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖并编译
cd frontend
npm install
npm run build
cd ..
```

### 步骤 3: 注册到 OpenClaw

编辑 `~/.openclaw/openclaw.json`，在 `skills` 部分添加：

```json
{
  "skills": {
    "openclaw-console": {
      "enabled": true,
      "path": "~/.openclaw/workspace/openclaw-console",
      "port": 4310,
      "autoStart": false,
      "bind": "localhost",
      "databasePath": "~/.openclaw/data/console.db"
    }
  }
}
```

### 步骤 4: 创建数据库

```bash
# 初始化 SQLite 数据库
npm run init-db
```

### 步骤 5: 验证安装

```bash
# 启动测试
openclaw console start
```

在浏览器访问 `http://localhost:4310`，如果能看到登录页面说明安装成功。

---

## 配置说明

OpenClaw Console 使用环境变量和 `openclaw.json` 双重配置。

### 环境变量 (.env)

在项目根目录创建 `.env` 文件：

```env
# 服务端口
PORT=4310

# 绑定地址 (默认只允许本地访问)
BIND=localhost

# OpenClaw Gateway 地址
GATEWAY_URL=http://localhost:18789

# OpenClaw Gateway API Token
GATEWAY_TOKEN=your-gateway-token-here

# SQLite 数据库路径
DATABASE_PATH=~/.openclaw/data/console.db

# 日志级别 (debug/info/warn/error)
LOG_LEVEL=info

# 开启调试模式
DEBUG=false
```

### 配置参数说明

| 参数 | 说明 | 默认值 | 是否必填 |
|------|------|--------|----------|
| `PORT` | Console 服务监听端口 | `4310` | 可选 |
| `BIND` | 绑定地址，`0.0.0.0` 允许所有地址访问 | `localhost` | 可选 |
| `GATEWAY_URL` | OpenClaw Gateway API 地址 | `http://localhost:18789` | 可选 |
| `GATEWAY_TOKEN` | Gateway API 认证 Token | 从 OpenClaw 读取 | 可选 |
| `DATABASE_PATH` | SQLite 数据库文件路径 | `~/.openclaw/data/console.db` | 可选 |
| `LOG_LEVEL` | 日志输出级别 | `info` | 可选 |
| `DEBUG` | 是否开启调试模式 | `false` | 可选 |

### openclaw.json 配置示例

完整配置示例：

```json
{
  "server": {
    "port": 18789,
    "bind": "localhost"
  },
  "skills": {
    "openclaw-console": {
      "enabled": true,
      "port": 4310,
      "autoStart": false,
      "bind": "localhost",
      "databasePath": "~/.openclaw/data/console.db",
      "logLevel": "info",
      "cors": {
        "enabled": false,
        "origins": []
      }
    }
  }
}
```

### openclaw.json 参数说明

| 参数 | 说明 |
|------|------|
| `enabled` | 是否启用该 Skill |
| `port` | Console 服务端口 |
| `autoStart` | OpenClaw 启动时自动启动 Console |
| `bind` | 绑定地址 |
| `databasePath` | 数据库路径 |
| `logLevel` | 日志级别 |
| `cors.enabled` | 是否启用 CORS |
| `cors.origins` | 允许的 CORS 源列表 |

---

## 开机自启配置

### Windows (使用 PowerShell 脚本 + 任务计划程序)

#### 方法 1: 使用自带安装脚本 (推荐)

```powershell
# 以管理员身份运行 PowerShell
cd %USERPROFILE%\.openclaw\workspace\openclaw-console\scripts
.\install-autostart.ps1
```

#### 方法 2: 手动配置任务计划程序

1. 打开 **任务计划程序**
2. 创建 **基本任务**
3. 名称：`OpenClaw Console`
4. 触发器：**当计算机启动时**
5. 操作：**启动程序**
6. 程序或脚本：`powershell.exe`
7. 添加参数：`-Command "openclaw console start"`
8. 勾选 **不管用户是否登录都运行**
9. 完成

### Linux (使用 systemd)

1. 创建 systemd 服务文件：

```bash
sudo nano /etc/systemd/system/openclaw-console.service
```

2. 写入以下内容（替换 `your-username` 为你的用户名）：

```ini
[Unit]
Description=OpenClaw Console
After=network.target openclaw.service

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/.openclaw/workspace/openclaw-console
ExecStart=/usr/bin/openclaw console start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

3. 启用并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw-console
sudo systemctl start openclaw-console
```

4. 检查状态：

```bash
sudo systemctl status openclaw-console
```

### macOS (使用 launchd)

1. 创建 plist 文件：

```bash
nano ~/Library/LaunchAgents/ai.openclaw.console.plist
```

2. 写入以下内容（替换 `your-username` 为你的用户名）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.openclaw.console</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/openclaw</string>
        <string>console</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/your-username/.openclaw/logs/console.out.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/your-username/.openclaw/logs/console.err.log</string>
</dict>
</plist>
```

3. 加载并启动：

```bash
launchctl load ~/Library/LaunchAgents/ai.openclaw.console.plist
```

### 禁用开机自启

#### Windows
- 在任务计划程序中禁用或删除任务

#### Linux
```bash
sudo systemctl disable openclaw-console
sudo systemctl stop openclaw-console
```

#### macOS
```bash
launchctl unload ~/Library/LaunchAgents/ai.openclaw.console.plist
```

---

## 验证安装

安装完成后，执行以下命令验证：

```bash
# 启动控制台
openclaw console start

# 查看状态
openclaw console status
```

预期输出类似：

```
✓ OpenClaw Console is running
  - Port: 4310
  - Bind: localhost
  - PID: 12345
  - Uptime: 5 minutes
  - Database: ~/.openclaw/data/console.db
```

在浏览器访问：`http://localhost:4310`

如果能正常打开控制台界面，说明安装成功！

---

## 卸载

```bash
# 通过 ClawHub 卸载
openclaw skills uninstall openclaw-console
```

手动卸载步骤：
1. 删除项目目录：`rm -rf ~/.openclaw/workspace/openclaw-console`
2. 从 `openclaw.json` 中移除 `openclaw-console` 配置
3. （可选）删除数据库：`rm ~/.openclaw/data/console.db`

---

*文档版本: v1.0*  
*最后更新: 2026-04-10*
