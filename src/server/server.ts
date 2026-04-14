/**
 * @fileoverview Server management API routes
 * Provides server control functions like restart
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import express from 'express';
import path from 'path';
import fs from 'fs';

export const router = express.Router();

/**
 * @api {post} /api/server/restart Restart the server
 * @apiName RestartServer
 * @apiGroup Server
 * @apiDescription Restart the OpenClaw Console server by finding the process using port 3000, killing it, and restarting
 * @apiSuccess {String} status 'ok'
 * @apiSuccess {String} message 'Server restart initiated'
 * @apiError {String} status 'error'
 * @apiError {String} message Error description
 */
router.post('/restart', (req, res) => {
  // Return immediately as requested
  res.json({
    status: 'ok',
    message: 'Server restart initiated',
  });

  // Restart asynchronously after response is sent
  setTimeout(() => {
    try {
      const projectRoot = path.join(__dirname, '..', '..');
      const restartScriptPath = path.join(projectRoot, 'restart-server.ps1');
      const logPath = path.join(projectRoot, 'data', 'restart.log');
      
      // Ensure data directory exists for logs
      const dataDir = path.dirname(logPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      console.log(`[restart] Using existing restart script from: ${restartScriptPath}`);
      console.log(`[restart] Output will be logged to: ${logPath}`);
      
      // Use Start-Process with direct output redirection to avoid file locking conflicts
      // PowerShell's Start-Process will open the log file once and handle all output
      // This eliminates multiple processes trying to write to the same file
      const psCommand = `Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -NoProfile -File \"${restartScriptPath}\"" -RedirectStandardOutput "${logPath}" -RedirectStandardError "${logPath}" -NoNewWindow -Wait`;
      
      console.log(`[restart] Executing: ${psCommand}`);
      
      const { spawn } = require('child_process');
      const child = spawn('powershell.exe', ['-Command', psCommand], {
        cwd: projectRoot,
        detached: true,
        stdio: 'ignore'
      });
      
      // Unref the child so parent can exit
      child.unref();
      
    } catch (error) {
      console.error('[restart] Failed to restart server:', error);
    }
  }, 100);
});
