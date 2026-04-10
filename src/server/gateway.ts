/**
 * @fileoverview Gateway status API endpoints
 * Provides Gateway runtime status and channel information
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import express from 'express';
import axios from 'axios';

/** Gateway configuration from environment */
const GATEWAY_HOST = process.env.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = process.env.GATEWAY_PORT || '18789';
const GATEWAY_URL = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;

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
    const response = await axios.get(`${GATEWAY_URL}/status`, {
      timeout: 5000,
    });
    
    const data = response.data;
    
    // Process response into standardized format
    const status: GatewayStatus = {
      status: 'online',
      version: data.version || data.meta?.version,
      startTime: data.startTime || data.meta?.start_time,
      uptime: data.uptime || data.meta?.uptime,
      uptimeHuman: data.uptime ? formatUptime(data.uptime) : 
                  data.meta?.uptime ? formatUptime(data.meta.uptime) : undefined,
      memory: data.memory || data.process?.memory,
      connections: data.connections || data.meta?.connections,
      channels: [],
    };
    
    // Extract channel information if available
    if (data.channels || data.plugins) {
      const channelsData = data.channels || data.plugins || [];
      status.channels = Object.entries(channelsData).map(([id, info]: any) => ({
        id,
        name: info.name || id,
        type: info.type || id,
        status: info.connected || info.status === 'connected' ? 'connected' : 
                info.status === 'error' ? 'error' : 'disconnected',
        lastActive: info.lastActive,
      }));
    }
    
    // Fallback: if no channels from API, provide common channels with unknown status
    if (!status.channels || status.channels.length === 0) {
      status.channels = [
        { id: 'wechat', name: '微信', type: 'im', status: 'disconnected' },
        { id: 'feishu', name: '飞书', type: 'im', status: 'disconnected' },
        { id: 'discord', name: 'Discord', type: 'im', status: 'disconnected' },
        { id: 'telegram', name: 'Telegram', type: 'im', status: 'disconnected' },
      ];
    }
    
    // Calculate memory if not provided by API (convert to MB)
    if (!status.memory && (data.process || data.memoryUsage)) {
      const mem = data.process?.memoryUsage || data.memoryUsage;
      if (mem) {
        const usedMB = Math.round(mem.heapUsed / 1024 / 1024);
        const totalMB = Math.round(mem.heapTotal / 1024 / 1024);
        status.memory = {
          used: usedMB,
          total: totalMB,
          percent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0,
        };
      }
    }
    
    res.json(status);
  } catch (error: any) {
    // Handle connection errors
    console.error('Failed to fetch Gateway status:', error.message);
    
    const status: GatewayStatus = {
      status: 'offline',
      error: `Cannot connect to Gateway at ${GATEWAY_URL}: ${error.message}`,
    };
    
    if (error.response) {
      // Gateway responded with error
      status.status = 'error';
      status.error = `Gateway responded with error: ${error.response.status}`;
    }
    
    res.status(200).json(status);
  }
});

export { router };
export default router;
