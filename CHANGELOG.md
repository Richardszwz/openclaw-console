# Changelog

All notable changes to this project will be documented in this file.

## [v0.2.0] - 2026-04-14

### Added
- Complete frontend pages:
  - Agents list page + Agent detail page
  - Models management page
  - Logs viewer page
  - Sessions list page + Session detail page
  - Tasks list page + Task editor page
  - Workflow view page + Workflow properties editor page
- Complete backend REST APIs:
  - `src/server/agents.ts` - Agent management API
  - `src/server/models.ts` - Models management API
  - `src/server/logs.ts` - Logs API
  - `src/server/sessions.ts` - Sessions API
  - `src/server/tasks.ts` - Tasks API
  - `src/server/workflows.ts` - Workflows API
  - `src/server/alerts.ts` - Alerts/notifications API
  - `src/server/notifications.ts` - Notifications API
  - `src/server/server.ts` - Server configuration
  - `src/server/skills.ts` - Skills management API
- One-click PowerShell scripts for Windows:
  - `start-server.ps1` - Simple production startup (UTF-8 fix for Chinese)
  - `restart-server.ps1` - Auto-kill process on port 3000 and restart

### Changed
- Updated `App.tsx` routing for all new pages
- Updated `Dashboard` layout and styling
- Split monolithic `index.ts` into modular API files
- Fixed Chinese character encoding in console output

### Updated
- `package.json` and `package-lock.json` dependencies
- ESLint configuration

## [v0.1.0] - 2026-04-11

### Added
- Initial project clone and setup
- React 18 + TypeScript + Vite frontend
- Express.js + TypeScript backend
- Dashboard page
- Basic project skeleton
- Installation script

[v0.2.0]: https://github.com/Richardszwz/openclaw-console/releases/tag/v0.2.0
[v0.1.0]: https://github.com/Richardszwz/openclaw-console/releases/tag/v0.1.0
