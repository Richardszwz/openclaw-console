/**
 * @fileoverview Gateway status API endpoints
 * Provides Gateway runtime status and channel information
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** Gateway configuration from environment */
const GATEWAY_HOST = process.env.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = process.env.GATEWAY_PORT || '18789';
const GATEWAY_URL = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;

/** Server start time for calculating uptime */
const SERVER_START_TIME = Date.now();

/**
 * Check if request is from an administrator
 * For simplicity, this checks for a simple admin token in headers
 * In production, this should use proper authentication
 */
function isAdmin(req: express.Request): boolean {
  const authHeader = req.headers.authorization;
  const adminToken = process.env.OPENCLAW_ADMIN_TOKEN;
  
  // If no admin token configured
  if (!adminToken) {
    // If running locally, allow admin
    // Use remoteAddress instead of Host header to prevent Host header forgery
    const remoteAddr = req.socket.remoteAddress || '';
    // Check for localhost addresses: IPv4 127.0.0.1, IPv6 ::1, and IPv6-mapped IPv4
    if (remoteAddr === '127.0.0.1' || 
        remoteAddr === '::1' || 
        remoteAddr.endsWith('::ffff:127.0.0.1')) {
      return true;
    }
    // In production without configured token, reject admin access
    return false;
  }
  
  // If no authorization header, reject
  if (!authHeader) {
    return false;
  }
  
  // Check for admin token from environment
  const token = authHeader.replace('Bearer ', '').trim();
  return token === adminToken;
}

/**
 * Error response for unauthorized access
 */
function sendUnauthorized(res: express.Response) {
  res.status(401).json({
    error: 'Unauthorized - Administrator access required'
  });
}

/** Router for gateway endpoints */
const router = express.Router();

/**
 * Gateway status response structure
 */
export interface GatewayStatus {
  status: 'online' | 'offline' | 'error';
  version?: string;
  startTime?: string;
  uptime?: number;
  uptimeHuman?: string;
  memory?: {
    used: number;
    total: number;
    percent: number;
  };
  connections?: number;
  channels?: ChannelInfo[];
  error?: string;
}

/**
 * Channel information structure
 */
export interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  lastActive?: string;
}

/**
 * Format uptime to human readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && days === 0) parts.push(`${secs}s`);
  return parts.join(' ') || '0s';
}

/**
 * @api {get} /api/gateway/status Get Gateway status
 * @apiName GetGatewayStatus
 * @apiGroup Gateway
 * @apiDescription Get current Gateway runtime status including version, uptime, memory and channels
 * @apiSuccess {String} status Gateway online/offline/error status
 * @apiSuccess {String} [version] Gateway version
 * @apiSuccess {String} [startTime] ISO start time
 * @apiSuccess {Number} [uptime] Uptime in seconds
 * @apiSuccess {String} [uptimeHuman] Human readable uptime
 * @apiSuccess {Object} [memory] Memory usage information
 * @apiSuccess {Number} memory.used Used memory in MB
 * @apiSuccess {Number} memory.total Total available memory in MB
 * @apiSuccess {Number} memory.percent Memory usage percentage
 * @apiSuccess {Number} [connections] Number of active connections
 * @apiSuccess {ChannelInfo[]} [channels] List of channels with their status
 * @apiError {String} status Always 'error'
 * @apiError {String} error Error message
 * @apiExample {curl} Example usage:
 *   curl http://localhost:3000/api/gateway/status
 */
router.get('/status', async (req, res) => {
  try {
    // Try to fetch status from Gateway HTTP API
    // Note: Gateway itself serves web UI on /status, so we just check if it's reachable
    const response = await axios.get(`${GATEWAY_URL}/status`, {
      timeout: 5000,
      maxContentLength: 1000000, // Limit size since it's HTML
    });
    
    // If we got here, Gateway is online
    
    // Try to get detailed stats from Gateway's internal API
    // Some versions of OpenClaw Gateway expose /api/status
    let gatewayStats: any = null;
    try {
      const statsResponse = await axios.get(`${GATEWAY_URL}/api/status`, { timeout: 2000 });
      if (statsResponse.status === 200 && statsResponse.data) {
        gatewayStats = statsResponse.data;
      }
    } catch {}
    
    // Calculate uptime: 
    // 1. If Gateway provides uptime, use that
    // 2. Otherwise use console server uptime as approximation
    let uptimeSeconds: number;
    let startTime: string;
    
    if (gatewayStats && gatewayStats.uptime) {
      uptimeSeconds = Math.floor(gatewayStats.uptime);
      startTime = gatewayStats.startTime || new Date(Date.now() - uptimeSeconds * 1000).toISOString();
    } else {
      // Fallback: use console server start time
      uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
      startTime = new Date(SERVER_START_TIME).toISOString();
    }
    
    const uptimeHuman = formatUptime(uptimeSeconds);
    
    const status: GatewayStatus = {
      status: 'online',
      version: process.env.OPENCLAW_VERSION || '2026.4.9',
      startTime,
      uptime: uptimeSeconds,
      uptimeHuman,
      memory: undefined,
      connections: undefined,
      channels: [],
    };
    
    // Get system-level memory usage (total system memory, not just Node.js heap)
    const totalMemoryBytes = os.totalmem();
    const freeMemoryBytes = os.freemem();
    const usedMemoryBytes = totalMemoryBytes - freeMemoryBytes;
    const totalMemoryMB = Math.round(totalMemoryBytes / 1024 / 1024);
    const usedMemoryMB = Math.round(usedMemoryBytes / 1024 / 1024);
    const percent = totalMemoryMB > 0 ? Math.round((usedMemoryMB / totalMemoryMB) * 100) : 0;
    status.memory = {
      used: usedMemoryMB,
      total: totalMemoryMB,
      percent,
    };
    
    // Try to get number of active connections to Gateway port
    // Different methods for different platforms
    try {
      if (process.platform === 'win32') {
        // Windows: use netstat to find established connections to GATEWAY_PORT
        const { stdout } = await execAsync(`netstat -an | findstr :${GATEWAY_PORT} | findstr ESTABLISHED`);
        const lines = stdout.trim().split('\n').filter(line => line.length > 0);
        status.connections = lines.length;
      } else {
        // Linux/macOS: use ss or netstat
        try {
          const { stdout } = await execAsync(`ss -tun | grep :${GATEWAY_PORT} | grep -v LISTEN`);
          const lines = stdout.trim().split('\n').filter(line => line.length > 0);
          status.connections = lines.length;
        } catch {
          // Fallback to netstat
          const { stdout } = await execAsync(`netstat -anp tcp 2>/dev/null | grep :${GATEWAY_PORT} | grep -v LISTEN`);
          const lines = stdout.trim().split('\n').filter(line => line.length > 0);
          status.connections = lines.length;
        }
      }
    } catch (error) {
      // If command fails, default to 0 (but at least we tried)
      console.warn('Failed to count active connections:', error);
      status.connections = 0;
    }
    
    // Get channel configuration from OpenClaw config
    const configPath = path.join(
      process.env.HOME || process.env.USERPROFILE || '~',
      '.openclaw',
      'openclaw.json'
    );
    
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        if (config.channels) {
          status.channels = Object.entries(config.channels).map(([id, info]: [string, any]) => {
            return {
              id,
              name: id.charAt(0).toUpperCase() + id.slice(1),
              type: 'im',
              status: info.enabled === true ? 'connected' : 'disconnected',
              lastActive: info.connectionMode ? info.connectionMode : undefined,
            };
          });
        }
      } catch {}
    }
    
    // Fallback: if no channels from config, provide common channels
    if (!status.channels || status.channels.length === 0) {
      status.channels = [
        { id: 'wechat', name: '微信', type: 'im', status: 'disconnected' },
        { id: 'feishu', name: '飞书', type: 'im', status: 'disconnected' },
        { id: 'discord', name: 'Discord', type: 'im', status: 'disconnected' },
        { id: 'telegram', name: 'Telegram', type: 'im', status: 'disconnected' },
      ];
    }
    
    res.json(status);
  } catch (error: unknown) {
    // Handle connection errors
    console.error('Failed to fetch Gateway status:', error instanceof Error ? error.message : String(error));
    
    const status: GatewayStatus = {
      status: 'offline',
      error: `Cannot connect to Gateway at ${GATEWAY_URL}: ${error instanceof Error ? error.message : String(error)}`,
    };
    
    if (error && typeof error === 'object' && 'response' in error) {
      // Gateway responded with error
      status.status = 'error';
      const err = error as { response?: { status: number } };
      status.error = `Gateway responded with error: ${err.response?.status}`;
    }
    
    res.status(200).json(status);
  }
});

/**
 * @api {post} /api/gateway/restart Restart Gateway
 * @apiName RestartGateway
 * @apiGroup Gateway
 * @apiDescription Restart the Gateway service (requires admin privileges)
 * @apiPermission admin
 * @apiSuccess {String} status success
 * @apiSuccess {String} message Success message
 * @apiError {String} error Error message
 * @apiError 401 Unauthorized
 */
router.post('/restart', async (req, res) => {
  if (!isAdmin(req)) {
    return sendUnauthorized(res);
  }

  try {
    // Try different commands based on platform
    const isWindows = process.platform === 'win32';
    const restartCmd = isWindows 
      ? 'npx openclaw gateway restart' 
      : 'sudo systemctl restart openclaw || openclaw gateway restart';
    
    await execAsync(restartCmd);
    
    res.json({
      status: 'success',
      message: 'Gateway restart initiated'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to restart Gateway:', message);
    res.status(500).json({
      error: `Failed to restart Gateway: ${message}`
    });
  }
});

/**
 * @api {post} /api/gateway/stop Stop Gateway
 * @apiName StopGateway
 * @apiGroup Gateway
 * @apiDescription Stop the Gateway service (requires admin privileges)
 * @apiPermission admin
 * @apiSuccess {String} status success
 * @apiSuccess {String} message Success message
 * @apiError {String} error Error message
 * @apiError 401 Unauthorized
 */
router.post('/stop', async (req, res) => {
  if (!isAdmin(req)) {
    return sendUnauthorized(res);
  }

  // Safety: warn about stopping
  console.warn('WARNING: Gateway stop requested via API');

  try {
    const isWindows = process.platform === 'win32';
    const stopCmd = isWindows 
      ? 'npx openclaw gateway stop' 
      : 'sudo systemctl stop openclaw || openclaw gateway stop';
    
    await execAsync(stopCmd);
    
    res.json({
      status: 'success',
      message: 'Gateway stop initiated'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to stop Gateway:', message);
    res.status(500).json({
      error: `Failed to stop Gateway: ${message}`
    });
  }
});

export { router };
export default router;
