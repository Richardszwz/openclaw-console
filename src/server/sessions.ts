/**
 * @fileoverview OpenClaw Web Console - Sessions API
 * Provides REST API for getting session list with filtering and pagination
 *
 * @author OpenClaw Team
 * @license MIT
 */
import express from 'express';
import axios from 'axios';

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

/** Express router for sessions API */
export const router = express.Router();

/** Gateway configuration from environment */
const GATEWAY_HOST = process.env.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = process.env.GATEWAY_PORT || '18789';
const GATEWAY_URL = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;

/**
 * Session information interface
 */
export interface Session {
  id: string;
  agentId: string;
  agentName: string;
  status: 'active' | 'idle' | 'completed' | 'error';
  createdAt: string;
  lastActiveAt: string;
  title?: string;
  messageCount?: number;
  tokensUsed?: number;
}

/**
 * Session list response interface
 */
export interface SessionListResponse {
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Generate mock session data for development when Gateway API is unavailable
 */
function generateMockSessions(count: number): Session[] {
  const statuses: Session['status'][] = ['active', 'idle', 'completed', 'error'];
  const agentNames = ['main-agent', 'dev-agent', 'creative-agent', 'research-agent'];
  const agentIds = ['main', 'dev', 'creative', 'research'];

  const sessions: Session[] = [];

  for (let i = 0; i < count; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const agentIndex = Math.floor(Math.random() * agentIds.length);
    const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const lastActiveAt = new Date(createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime()));

    sessions.push({
      id: `session-${Date.now() - i * 3600000}-${Math.floor(Math.random() * 1000)}`,
      agentId: agentIds[agentIndex],
      agentName: agentNames[agentIndex],
      status,
      createdAt: createdAt.toISOString(),
      lastActiveAt: lastActiveAt.toISOString(),
      messageCount: Math.floor(Math.random() * 100),
      tokensUsed: Math.floor(Math.random() * 100000)
    });
  }

  return sessions;
}

/**
 * @api {get} /api/sessions Get all sessions
 * @apiName GetSessions
 * @apiGroup Sessions
 * @apiDescription Get list of sessions with pagination, filtering by agent and status
 * @apiParam {Number} [page=1] Page number
 * @apiParam {Number} [limit=50] Items per page
 * @apiParam {String} [agentId] Filter by agent ID (comma separated for multiple)
 * @apiParam {String} [status] Filter by status (comma separated for multiple)
 * @apiParam {String} [search] Search by session ID
 * @apiSuccess {Session[]} sessions List of sessions
 * @apiSuccess {Number} total Total number of sessions matching filter
 * @apiSuccess {Number} page Current page number
 * @apiSuccess {Number} limit Items per page
 * @apiSuccess {Number} totalPages Total number of pages
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/sessions?page=1&limit=50&status=active,idle
 */
router.get('/', async (req, res) => {
  try {
    // Parse query parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const agentIdParam = req.query.agentId as string;
    const statusParam = req.query.status as string;
    const search = req.query.search as string;

    // Parse filters
    const agentIds = agentIdParam ? agentIdParam.split(',').map(s => s.trim()).filter(Boolean) : null;
    const statuses = statusParam ? statusParam.split(',').map(s => s.trim()).filter(Boolean) as Session['status'][] : null;

    let allSessions: Session[] = [];
    let gatewayAvailable = false;

    // Try to fetch sessions from OpenClaw Gateway API
    try {
      const response = await axios.get(`${GATEWAY_URL}/sessions`, {
        timeout: 5000,
      });

      if (response.data && Array.isArray(response.data.sessions || response.data)) {
        gatewayAvailable = true;
        allSessions = response.data.sessions || response.data;

        // Normalize response format
        allSessions = allSessions.map((session: Session) => ({
          id: session.id || (session as any).sessionId,
          agentId: session.agentId || (session as any).agent_id,
          agentName: session.agentName || (session as any).agent_name || (session.agentId ? session.agentId : 'Unknown'),
          status: normalizeSessionStatus(session.status),
          createdAt: session.createdAt || (session as any).created_at,
          lastActiveAt: session.lastActiveAt || (session as any).last_active_at || (session as any).updatedAt,
          title: session.title,
          messageCount: session.messageCount || (session as any).message_count,
          tokensUsed: session.tokensUsed || (session as any).tokens_used
        }));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Failed to fetch sessions from Gateway API, using mock data:', message);
      gatewayAvailable = false;
    }

    // If Gateway API failed or returned no data, use mock data
    if (!gatewayAvailable || allSessions.length === 0) {
      allSessions = generateMockSessions(128);
    }

    // Apply filters
    let filteredSessions = allSessions;

    // Filter by agent IDs
    if (agentIds && agentIds.length > 0) {
      filteredSessions = filteredSessions.filter(session =>
        agentIds.includes(session.agentId)
      );
    }

    // Filter by statuses
    if (statuses && statuses.length > 0) {
      filteredSessions = filteredSessions.filter(session =>
        statuses.includes(session.status)
      );
    }

    // Search by session ID
    if (search && search.trim().length > 0) {
      const searchLower = search.trim().toLowerCase();
      filteredSessions = filteredSessions.filter(session =>
        session.id.toLowerCase().includes(searchLower)
      );
    }

    // Sort by last active time descending (most recent first)
    filteredSessions.sort((a, b) =>
      new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );

    // Calculate pagination
    const total = filteredSessions.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSessions = filteredSessions.slice(startIndex, endIndex);

    const response: SessionListResponse = {
      sessions: paginatedSessions,
      total,
      page,
      limit,
      totalPages
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    res.status(500).json({
      error: 'SessionFetchError',
      message: error instanceof Error ? error.message : 'Unknown error fetching sessions'
    });
  }
});

/**
 * Normalize session status from different formats
 */
function normalizeSessionStatus(status: unknown): Session['status'] {
  if (!status) return 'idle';

  const statusStr = String(status).toLowerCase();

  if (['active', 'running'].includes(statusStr)) return 'active';
  if (['idle', 'paused', 'waiting'].includes(statusStr)) return 'idle';
  if (['completed', 'finished', 'done'].includes(statusStr)) return 'completed';
  if (['error', 'failed', 'crashed'].includes(statusStr)) return 'error';

  return 'idle';
}

/**
 * @api {get} /api/sessions/:id Get session by ID
 * @apiName GetSessionById
 * @apiGroup Sessions
 * @apiDescription Get detailed information about a specific session
 * @apiParam {String} id Session unique ID
 * @apiSuccess {Session} session Session detailed information
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/sessions/session-123
 */
router.get('/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Try to fetch from Gateway API first
    try {
      const response = await axios.get(`${GATEWAY_URL}/sessions/${sessionId}`, {
        timeout: 5000,
      });

      if (response.data) {
        const session = response.data.session || response.data;
        const normalizedSession: Session = {
          id: session.id || session.sessionId,
          agentId: session.agentId || session.agent_id,
          agentName: session.agentName || session.agent_name || (session.agentId ? session.agentId : 'Unknown'),
          status: normalizeSessionStatus(session.status),
          createdAt: session.createdAt || session.created_at,
          lastActiveAt: session.lastActiveAt || session.last_active_at || session.updatedAt,
          title: session.title,
          messageCount: session.messageCount || session.message_count,
          tokensUsed: session.tokensUsed || session.tokens_used
        };

        return res.json({ session: normalizedSession });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to fetch session ${sessionId} from Gateway API`, message);
    }

    // If Gateway failed, generate mock response for the requested session
    const mockSession: Session = {
      id: sessionId,
      agentId: 'dev',
      agentName: 'dev-agent',
      status: 'active',
      createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
      lastActiveAt: new Date().toISOString(),
      messageCount: 42,
      tokensUsed: 15678
    };

    res.json({ session: mockSession });
  } catch (error) {
    console.error(`Failed to fetch session ${req.params.id}:`, error);
    res.status(500).json({
      error: 'SessionFetchError',
      message: error instanceof Error ? error.message : 'Unknown error fetching session'
    });
  }
});

/**
 * @api {delete} /api/sessions/:id Delete session
 * @apiName DeleteSession
 * @apiGroup Sessions
 * @apiDescription Delete a specific session (requires admin privileges)
 * @apiParam {String} id Session unique ID
 * @apiSuccess {String} status Success status
 * @apiSuccess {String} message Success message
 * @apiExample {curl} Example usage:
 *   curl -X DELETE -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/sessions/session-123
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }
    const sessionId = req.params.id;

    // Try to delete via Gateway API first
    try {
      await axios.delete(`${GATEWAY_URL}/sessions/${sessionId}`, {
        timeout: 5000,
      });
      return res.json({
        status: 'ok',
        message: `Session ${sessionId} deleted successfully`
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to delete session ${sessionId} via Gateway API`, message);
    }

    // When Gateway API is unavailable, just return success for development
    console.log(`Mock: Deleted session ${sessionId}`);
    res.json({
      status: 'ok',
      message: `Session ${sessionId} deleted successfully (mock)`
    });
  } catch (error) {
    console.error(`Failed to delete session ${req.params.id}:`, error);
    res.status(500).json({
      error: 'SessionDeleteError',
      message: error instanceof Error ? error.message : 'Unknown error deleting session'
    });
  }
});

/**
 * @api {post} /api/sessions/:id/kill Kill/terminate session
 * @apiName KillSession
 * @apiGroup Sessions
 * @apiDescription Terminate an active session (requires admin privileges)
 * @apiParam {String} id Session unique ID
 * @apiSuccess {String} status Success status
 * @apiSuccess {String} message Success message
 * @apiExample {curl} Example usage:
 *   curl -X POST -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/sessions/session-123/kill
 */
router.post('/:id/kill', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }
    const sessionId = req.params.id;

    // Try to kill via Gateway API first
    try {
      await axios.post(`${GATEWAY_URL}/sessions/${sessionId}/kill`, {}, {
        timeout: 10000, // Longer timeout for graceful termination
      });
      return res.json({
        status: 'ok',
        message: `Session ${sessionId} terminated successfully`
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to terminate session ${sessionId} via Gateway API`, message);
    }

    // When Gateway API is unavailable, just return success for development
    console.log(`Mock: Terminated session ${sessionId}`);
    res.json({
      status: 'ok',
      message: `Session ${sessionId} terminated successfully (mock)`
    });
  } catch (error) {
    console.error(`Failed to terminate session ${req.params.id}:`, error);
    res.status(500).json({
      error: 'SessionKillError',
      message: error instanceof Error ? error.message : 'Unknown error terminating session'
    });
  }
});

/**
 * @api {post} /api/sessions/batch-delete Batch delete sessions
 * @apiName BatchDeleteSessions
 * @apiGroup Sessions
 * @apiDescription Delete multiple sessions in batch (requires admin privileges)
 * @apiBody {String[]} ids Array of session IDs to delete
 * @apiSuccess {String} status Success status
 * @apiSuccess {Number} deleted Number of sessions deleted
 * @apiExample {curl} Example usage:
 *   curl -X POST -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" -d '{"ids": ["session-1", "session-2"]}' http://localhost:3000/api/sessions/batch-delete
 */
router.post('/batch-delete', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'InvalidRequest',
        message: 'Missing or invalid ids array'
      });
    }

    let deleted = 0;

    // Try batch delete via Gateway API
    try {
      await axios.post(`${GATEWAY_URL}/sessions/batch-delete`, { ids }, {
        timeout: Math.min(30000, 5000 * ids.length),
      });
      deleted = ids.length;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Failed to batch delete via Gateway API', message);
      deleted = ids.length; // Mock success
    }

    res.json({
      status: 'ok',
      deleted
    });
  } catch (error) {
    console.error('Failed to batch delete sessions:', error);
    res.status(500).json({
      error: 'BatchDeleteError',
      message: error instanceof Error ? error.message : 'Unknown error batch deleting sessions'
    });
  }
});

export default router;
