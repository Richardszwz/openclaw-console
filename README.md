# OpenClaw Web Console

A modern web-based management console for OpenClaw, built with React 18, TypeScript, and Express.js.

## Quick Start (Windows)

```powershell
# Clone and run the installation script
git clone <repository-url> openclaw-console
cd openclaw-console
.\scripts\install.ps1
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
│   └── server/            # Express backend API
├── scripts/               # Installation and utility scripts
├── data/                  # SQLite database (gitignored)
├── dist/                  # Compiled output (gitignored)
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
