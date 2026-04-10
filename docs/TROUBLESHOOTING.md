# OpenClaw Console 问题排查手册

## 目录
- [常见问题清单](#常见问题清单)
- [安装失败排查](#安装失败排查)
- [启动失败排查](#启动失败排查)
- [性能问题排查](#性能问题排查)
- [日志查看位置](#日志查看位置)
- [问题反馈方式](#问题反馈方式)

---

## 常见问题清单

### Q: 访问 http://localhost:4310 显示无法连接
**A**: 可能原因：
1. 服务未启动 → 运行 `openclaw console start` 启动
2. 端口被占用 → 查看[端口占用问题](#端口被占用如何处理)
3. 绑定地址配置错误 → 检查 `bind` 配置

---

### Q: 页面能打开，但显示"无法连接到服务器"
**A**: 这是前端无法连接后端 WebSocket。检查：
1. 后端服务是否正常运行
2. 网络是否正常
3. 如果是反向代理，确认是否支持 WebSocket

---

### Q: Gateway 状态显示不在线
**A**:
1. 检查 OpenClaw Gateway 是否启动：`openclaw gateway status`
2. 检查 `GATEWAY_URL` 配置是否正确（默认 `http://localhost:18789`）
3. 检查 Gateway Token 是否匹配

---

### Q: 看不到 Agent 列表
**A**:
1. 确认 `openclaw.json` 中是否配置了 Agent
2. 确认 Console 是否有读取 `openclaw.json` 的权限
3. 检查日志看是否有解析错误

---

### Q: 模型用量不显示
**A**:
1. 确认模型配置中 API Key 是否正确
2. 确认 API Key 是否有用量查询权限
3. 检查网络是否能访问对应平台 API
4. 部分平台不提供用量查询 API，需要手动统计

---

### Q: 忘记配置，想重置为默认
**A**:
删除 `~/.openclaw/data/console.db` 然后重启 Console，会自动重新初始化数据库。
注意：这会清空所有自定义配置，包括工作流和任务。

---

## 安装失败排查

### 症状 1: `openclaw skills install` 命令失败

**可能原因 1: 网络问题，无法下载**
```
Error: connect ETIMEDOUT
```
**解决方案**：
```bash
# 使用国内镜像
export CLAWHUB_MIRROR=https://mirror.ghproxy.com/https://github.com
openclaw skills install openclaw/openclaw-console
```

**可能原因 2: 权限不足**
```
Error: EACCES: permission denied
```
**解决方案**：
- **Linux/macOS**: 检查目录权限
  ```bash
  sudo chown -R $USER:$USER ~/.openclaw
  ```
- **Windows**: 以管理员身份运行 PowerShell

**可能原因 3: Node.js 版本太低**
```
Error: Requires Node.js >= 20
```
**解决方案**：
升级 Node.js 到 v20 或更高版本：
- Windows: `nvm install 20 && nvm use 20`
- macOS: `brew upgrade node`
- Linux: 使用 NodeSource 仓库升级

---

### 症状 2: npm install 失败

**可能原因 1: 网络问题，无法下载依赖**
**解决方案**：使用淘宝 npm 镜像：
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

**可能原因 2: 依赖包编译失败 (node-gyp)**
```
gyp ERR! build error
```
**解决方案**：
- **Windows**: 需要安装 Visual Studio Build Tools
  ```powershell
  npm install -g windows-build-tools
  ```
- **Linux**: 需要安装 python 和 make
  ```bash
  # Debian/Ubuntu
  sudo apt install python3 make g++
  ```
- **macOS**: 需要安装 XCode Command Line Tools
  ```bash
  xcode-select --install
  ```

---

### 症状 3: 前端编译失败

**可能原因**: 内存不足
```
FATAL ERROR: Reached heap limit Allocation failed
```
**解决方案**：增加 Node.js 内存限制：
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

## 启动失败排查

### 步骤 1: 查看错误信息

```bash
# 手动启动查看直接输出
openclaw console start
# 查看输出的错误信息
```

### 步骤 2: 检查日志

查看日志文件，具体位置见 [日志查看位置](#日志查看位置)

### 常见启动失败原因

#### 端口被占用如何处理

**症状**:
```
Error: listen EADDRINUSE: address already in use :::4310
```

**排查**:
```bash
# Windows
netstat -ano | findstr :4310

# Linux/macOS
lsof -i :4310
```

**解决方案**:

1. **找到占用进程并杀死**：
   - Windows: `taskkill /PID <pid> /F`
   - Linux/macOS: `kill -9 <pid>`

2. **修改 Console 端口**：
   编辑 `openclaw.json`：
   ```json
   {
     "skills": {
       "openclaw-console": {
         "port": 4311  # 修改为其他端口
       }
     }
   }
   ```
   然后重启 Console。

---

#### 数据库文件损坏

**症状**:
```
SQLite Error: database disk image is malformed
```

**解决方案**:
```bash
# 备份损坏的数据库
mv ~/.openclaw/data/console.db ~/.openclaw/data/console.db.bak

# 重启 Console，会自动创建新数据库
openclaw console start
```

如果需要恢复配置，从备份中手动提取。

---

#### 配置文件 JSON 格式错误

**症状**:
```
SyntaxError: Unexpected token } in JSON at position XXX
```
**解决方案**:
1. 打开 `openclaw.json`
2. 找到报错位置，修复 JSON 语法（通常是缺少逗号或括号不匹配）
3. 保存后重启

可以使用 https://jsonlint.com/ 在线验证 JSON 格式。

---

#### OpenClaw Gateway 连接失败

**症状**:
```
Failed to connect to OpenClaw Gateway: connect ECONNREFUSED
```
**排查步骤**:
1. 确认 Gateway 已启动：`openclaw gateway status`
   - 如果未启动：`openclaw gateway start`
2. 检查 `GATEWAY_URL` 配置是否正确
   - 默认：`http://localhost:18789`
3. 检查防火墙是否阻止连接
   - Linux: `sudo ufw allow from 127.0.0.1 to any port 18789`
4. 检查 Gateway Token 是否匹配
   - Console 自动从 OpenClaw 读取，手动安装时需要检查 `.env`

---

#### 权限错误

**症状**:
```
Error: EACCES: permission denied, open '.../console.db'
```
**解决方案**:
```bash
# 修改目录权限
chown -R your-user:your-group ~/.openclaw/data
chmod 644 ~/.openclaw/data/console.db
```

---

## 性能问题排查

### 症状 1: 页面加载很慢

**排查**:
1. 查看 Chrome DevTools → Network 标签，看哪个请求慢
2. 检查网络连接
3. 如果是会话列表加载慢：
   - 可能是会话记录太多
   - 建议删除超过 90 天的历史会话

**优化**:
- 开启浏览器缓存（默认已开启）
- 定期清理历史会话
- 数据库过大时执行 VACUUM 优化：
  ```bash
  sqlite3 ~/.openclaw/data/console.db "VACUUM;"
  ```

---

### 症状 2: 内存占用过高

**排查**:
```bash
# 查看进程内存占用
# Linux/macOS
ps -o pid,%mem,cmd $(pidof node)

# Windows
tasklist | findstr node
```

**可能原因和优化**:
1. **日志太多**: 开启日志轮转，清理旧日志
   ```bash
   # 清理旧日志
   rm ~/.openclaw/logs/console.*.log
   ```
2. **大量历史会话**: 删除不需要的历史会话
3. **内存泄漏**: 如果内存持续增长，请重启 Console：
   ```bash
   openclaw console restart
   ```

**正常内存范围**: 运行时通常在 100MB - 300MB 之间，超过 500MB 建议重启。

---

### 症状 3: WebSocket 频繁断开重连

**排查**:
1. 检查网络是否稳定
2. 检查反向代理的超时设置
   - Nginx 需要设置：
     ```nginx
     proxy_read_timeout 86400;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     ```
3. 检查防火墙是否关闭空闲连接

---

### 症状 4: 实时更新不及时

**解决方案**:
- 检查浏览器控制台是否有错误
- 确认网络允许 WebSocket 连接
- 如果使用 CDN 或反向代理，确认支持 WebSocket

---

## 日志查看位置

### 默认日志路径

| 操作系统 | 日志路径 |
|----------|----------|
| Windows | `%USERPROFILE%\.openclaw\logs\console.log` |
| Linux | `~/.openclaw/logs/console.log` |
| macOS | `~/.openclaw/logs/console.log` |

### 项目内日志路径（手动安装）

```
<project-root>/logs/console.log
<project-root>/logs/error.log
```

### 查看最新日志

```bash
# 查看最后 100 行
tail -n 100 ~/.openclaw/logs/console.log

# 实时查看
tail -f ~/.openclaw/logs/console.log

# Windows PowerShell
Get-Content $env:USERPROFILE\.openclaw\logs\console.log -Tail 100 -Wait
```

### 日志级别调整

在 `.env` 或 `openclaw.json` 中设置：

```json
{
  "skills": {
    "openclaw-console": {
      "logLevel": "debug"
    }
  }
}
```

可用级别：`error` < `warn` < `info` < `debug`

排查问题时建议设置为 `debug` 获取更多信息。

---

### 日志轮转

默认会自动轮转日志：
- 按天分割
- 保留最近 30 天日志
- 超过自动压缩归档

清理旧日志：
```bash
# 删除 30 天前的日志
find ~/.openclaw/logs -name "console*.log.*" -mtime +30 -delete
```

---

## 问题反馈方式

### 步骤 1: 收集必要信息

反馈问题前请收集：

1. **错误日志**: 复制相关的错误日志内容
2. **环境信息**:
   - Node.js 版本：`node --version`
   - 操作系统和版本
   - OpenClaw 版本：`openclaw --version`
   - OpenClaw Console 版本
3. **复现步骤**: 详细说明做了什么操作后出现问题
4. **截图**: 如果是界面问题，请提供截图
5. **期望行为**: 说明你期望的结果是什么

### 步骤 2: 查看已知问题

在 GitHub Issues 搜索是否已有相同问题：
https://github.com/openclaw/openclaw-console/issues

### 步骤 3: 提交新 Issue

1. 访问: https://github.com/openclaw/openclaw-console/issues/new
2. 填写标题（简洁描述问题）
3. 填写详细描述，包含：
   - 问题描述
   - 复现步骤
   - 环境信息
   - 错误日志
   - 截图（如果有）
4. 提交 Issue

### 步骤 4: 社区求助

加入 OpenClaw 社区：
- GitHub Discussions: https://github.com/openclaw/openclaw/discussions
- 飞书群组（请查看官方文档获取邀请链接）

---

## 安全问题

如果你发现安全漏洞，请不要公开提交 Issue，发送邮件到：security@openclaw.ai

---

## 快速排查检查表

遇到问题时按顺序检查：

- [ ] **Node.js 版本 >= 20.0.0** 吗？
- [ ] **OpenClaw 版本 >= 0.15.0** 吗？
- [ ] **端口 4310** 是否被占用？
- [ ] OpenClaw Gateway **是否正常运行**？
- [ ] `openclaw.json` JSON 格式 **是否正确**？
- [ ] 数据库文件 **是否损坏**？
- [ ] 文件/目录权限 **是否正确**？
- [ ] 查看日志 **有什么错误信息**？

---

## 获取帮助

- 官方文档: https://docs.openclaw.ai/console/
- GitHub 仓库: https://github.com/openclaw/openclaw-console
- Issues: https://github.com/openclaw/openclaw-console/issues

---

*文档版本: v1.0*  
*最后更新: 2026-04-10*
