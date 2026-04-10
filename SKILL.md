# OpenClaw Web Console

OpenClaw Web Console is a modern, responsive web-based management interface for OpenClaw, allowing you to manage your OpenClaw deployment through an intuitive UI instead of command line.

## Overview

This skill provides a full-featured web management console for OpenClaw, including system monitoring, configuration management, skill management, backup management, and user authentication.

## Features

### Core Features
- 🖥️ **Dashboard** - Real-time system overview showing OpenClaw status, resource usage, and recent activity
- 📊 **System Monitoring** - View CPU, memory, disk usage and process information
- 📝 **Logs Viewer** - Real-time system logs viewing with filtering and search
- 🔧 **Configuration Management** - Edit OpenClaw configuration through web UI
- 🧩 **Skill Management** - Browse, install, update, and remove OpenClaw skills
- 💾 **Backup Management** - Create, manage, and restore OpenClaw backups
- 🔐 **User Authentication** - Secure login system with role-based access control
- 📱 **Responsive Design** - Works on desktop, tablet and mobile devices
- 🌙 **Dark Mode** - Supports dark/light theme switching

### Security Features
- Password hashing with bcrypt
- Session-based authentication with automatic expiration
- CSRF protection
- Role-based access control (admin/user)

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenClaw already installed

### Automatic Installation (Windows)
```powershell
# Clone the repository to your OpenClaw skills directory
cd $env:USERPROFILE\.openclaw\workspace\skills
git clone <repository-url> openclaw-console
cd openclaw-console
.\scripts\install.ps1
```

### Manual Installation
```bash
# 1. Clone the repository
cd ~/.openclaw/workspace/skills
git clone <repository-url> openclaw-console
cd openclaw-console

# 2. Install dependencies
# Install server dependencies
cd src/server
npm install

# Install frontend dependencies
cd ../frontend
npm install

# 3. Build frontend
npm run build

# 4. Create environment file
cp ../../../.env.example .env
```

## Configuration

Edit the `.env` file in the project root:

```env
# Server configuration
PORT=3000          # Port to listen on
HOST=localhost     # Host to bind to (use 0.0.0.0 to allow external access)
NODE_ENV=production # production or development

# Database configuration
DB_PATH=./data/openclaw.db # Path to SQLite database file

# Security
JWT_SECRET=your-secret-key-here # Change this to a random string
SESSION_TIMEOUT=86400000      # Session timeout in milliseconds (default 24h)
```

## Starting the Console

### Development mode
```bash
cd openclaw-console
npm run dev
```

### Production mode
```bash
cd openclaw-console
npm start
```

### Running as a service (Windows)
```powershell
# Install as Windows service
.\scripts\install-service.ps1

# Start the service
Start-Service OpenClawConsole
```

## Usage

1. After starting the server, open your browser and navigate to `http://localhost:3000`
2. Register the first user (this user will automatically be an admin)
3. Log in with your credentials
4. Start managing your OpenClaw deployment through the web interface

### First-time Setup
- The first user registered becomes the system administrator
- You can add more users from the user management page
- Assign roles (admin/user) based on your needs

## API Endpoints

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/api/status` | Get service status | No |
| POST | `/api/auth/login` | Login user | No |
| POST | `/api/auth/logout` | Logout user | Yes |
| GET | `/api/auth/me` | Get current user info | Yes |
| GET | `/api/system/info` | Get system information | Yes |
| GET | `/api/system/metrics` | Get current metrics | Yes |
| GET | `/api/logs` | Get system logs | Yes |
| GET | `/api/skills` | List installed skills | Yes |
| POST | `/api/skills/install` | Install a new skill | Admin |
| DELETE | `/api/skills/:id` | Uninstall a skill | Admin |
| GET | `/api/backups` | List backups | Yes |
| POST | `/api/backups/create` | Create new backup | Admin |
| POST | `/api/backups/:id/restore` | Restore from backup | Admin |
| GET | `/api/settings` | Get settings | Yes |
| PUT | `/api/settings` | Update settings | Admin |

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build frontend for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint for code quality check |

## Project Structure

```
openclaw-console/
├── references/          # Reference documentation
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── UI-PROTOTYPE.md
├── scripts/             # Installation and utility scripts
├── src/
│   ├── server/          # Backend Express server
│   │   ├── database.ts  # Database setup and schema
│   │   └── index.ts     # Server entry point
│   └── frontend/        # React frontend application
├── data/                # SQLite database (created at runtime)
├── .env                 # Environment configuration
└── SKILL.md             # This file
```

## Development

See [references/ROADMAP.md](./references/ROADMAP.md) for development plan and [references/ARCHITECTURE.md](./references/ARCHITECTURE.md) for architecture documentation.

## Troubleshooting

### Can't connect to the server
- Check if the port is already in use
- Verify HOST and PORT settings in `.env`
- Check firewall settings if accessing from another machine

### Database initialization fails
- Ensure the data directory is writable
- Check permissions on the directory

### Frontend shows blank page
- Make sure you ran `npm run build`
- Check NODE_ENV is set to `production`
- Verify the path to frontend dist folder

## License

MIT
