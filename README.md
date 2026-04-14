# OpenClaw Web Console

A modern web-based management console for OpenClaw, built with React 18, TypeScript, and Express.js.

## Features

✅ **Completed Features**
- Dashboard overview
- Agent management (list + detail view)
- Model management
- Session management (list + detail view)
- Task management (list + editor)
- Workflow management (view + properties editor)
- Logs viewer
- Complete REST API backend

🚧 **In Progress**
- Real-time log streaming
- Advanced workflow editor
- Skill marketplace integration

## Quick Start (Windows)

```powershell
# Clone and run the installation script
git clone https://github.com/Richardszwz/openclaw-console.git
cd openclaw-console
.\scripts\install.ps1
```

**One-click start/restart:**
```powershell
# Start the server (production mode)
.\start-server.ps1

# Restart the server (kills process on port 3000 then restarts)
.\restart-server.ps1
```

## Manual Installation

1. Install dependencies:
   ```bash
   npm install
   cd src/frontend && npm install && cd ../..
   ```

2. Copy environment example:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   # Or use one-click PowerShell scripts: .\start-server.ps1
   ```

## Development

```bash
# Start backend dev server
npm run dev:server

# In another terminal, start frontend dev server
npm run dev:frontend
```

## Project Structure

```
openclaw-console/
├── src/
│   ├── frontend/          # React frontend application
│   │   └── src/pages/     # Dashboard, Agents, Models, Logs, Sessions, Tasks, Workflow
│   └── server/            # Express backend API
│       └── *.ts           # agents, models, logs, sessions, tasks, workflows APIs
├── scripts/               # Installation and utility scripts
├── data/                  # SQLite database (gitignored)
├── dist/                  # Compiled output (gitignored)
├── start-server.ps1       # One-click production startup (Windows)
├── restart-server.ps1     # One-click server restart (Windows)
└── ...config files
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: SQLite
- **Linting**: ESLint + Prettier
- **Build**: TypeScript compiler

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `HOST` | Server host | localhost |
| `DB_PATH` | Path to SQLite database | ./data/openclaw.db |
| `OPENCLAW_HOME` | Path to OpenClaw home directory | ~/.openclaw |

## License

MIT
