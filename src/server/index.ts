/**
 * @fileoverview OpenClaw Web Console - Express HTTP Server
 * Provides REST API for frontend and serves static assets
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { initDatabase } from './database';
import { router as gatewayRouter } from './gateway';
import { router as logsRouter } from './logs';
import { router as agentsRouter } from './agents';
import { router as sessionsRouter } from './sessions';
import { router as tasksRouter } from './tasks';
import { router as alertsRouter } from './alerts';
import { router as modelsRouter } from './models';
import { router as skillsRouter } from './skills';
import { router as serverRouter } from './server';
import * as workflows from './workflows';

// Load environment variables from .env file
dotenv.config();

/** Express application instance */
const app = express();
/** Server port from environment or default 3000 */
const PORT = process.env.PORT || 3000;
/** Server host from environment or default localhost */
const HOST = process.env.HOST || 'localhost';

// Initialize database schema
initDatabase();
workflows.initWorkflowsTable();
console.log('Database initialized');
console.log('Workflows table initialized');

/**
 * Global Middleware
 * - cors enables cross-origin requests for development
 * - express.json() parses JSON request bodies
 * - express.urlencoded() parses form data
 */
// Enable CORS for all origins in development
// In production, this should be restricted to specific origins
if (process.env.NODE_ENV === 'development') {
  app.use(cors());
} else {
  // For production, allow specific origins or restrict as needed
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || []
  }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Authentication middleware
 * Checks for Bearer token in Authorization header
 * Skips authentication for public endpoints like /api/status
 */
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip authentication for public endpoints
  if (req.path === '/api/status') {
    return next();
  }

  // If no API_TOKEN configured, skip authentication (development mode)
  const apiToken = process.env.API_TOKEN;
  if (!apiToken) {
    return next();
  }

  // Get authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid authorization token' });
  }

  // Extract token from header
  const token = authHeader.slice(7);
  if (token !== apiToken) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }

  // Token is valid, proceed
  next();
};

// Apply authentication middleware to all API routes
app.use('/api', authMiddleware);

/**
 * @api {get} /api/status Get service status
 * @apiName GetStatus
 * @apiGroup System
 * @apiDescription Check if the service is running (public endpoint, no authentication required)
 * @apiSuccess {String} status Always 'ok'
 * @apiSuccess {String} timestamp Current ISO timestamp
 * @apiSuccess {String} service Service name 'openclaw-console'
 * @apiExample {curl} Example usage:
 *   curl http://localhost:3000/api/status
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'openclaw-console',
  });
});

/**
 * Gateway status API routes (authenticated)
 */
app.use('/api/gateway', gatewayRouter);

/**
 * Logs API routes (authenticated)
 */
app.use('/api/logs', logsRouter);

/**
 * Agents API routes (authenticated)
 */
app.use('/api/agents', agentsRouter);

/**
 * Sessions API routes (authenticated)
 */
app.use('/api/sessions', sessionsRouter);

/**
 * Tasks API routes (authenticated)
 */
app.use('/api/tasks', tasksRouter);

/**
 * Alerts API routes (authenticated)
 */
app.use('/api/alerts', alertsRouter);

/**
 * Models API routes (authenticated)
 */
app.use('/api/models', modelsRouter);

/**
 * Skills API routes (authenticated)
 */
app.use('/api/skills', skillsRouter);

/**
 * Server management API routes (authenticated)
 */
app.use('/api/server', serverRouter);

/**
 * Workflows API routes (authenticated)
 */
app.get('/api/workflows', workflows.getAllWorkflows);
app.get('/api/workflows/:id', workflows.getWorkflowById);
app.post('/api/workflows', workflows.createWorkflow);
app.put('/api/workflows/:id', workflows.updateWorkflow);
app.delete('/api/workflows/:id', workflows.deleteWorkflow);
app.get('/api/workflows/:id/history', workflows.getWorkflowExecutionHistory);
app.post('/api/workflows/:id/execute', workflows.startWorkflowExecution);
app.put('/api/workflows/:id/executions/:executionId', workflows.updateWorkflowExecution);

/**
 * Serve static frontend files
 * Always serve the built frontend regardless of NODE_ENV
 * In development, you can still run Vite dev server separately
 */
const frontendDist = path.join(__dirname, '..', '..', 'src', 'frontend', 'dist');
app.use(express.static(frontendDist));

// Handle SPA routing - all non-API requests send index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(frontendDist, 'index.html'));
  }
});

/**
 * Start the Express server
 * Listens on configured HOST:PORT
 * @api public
 */
app.listen(Number(PORT), HOST, () => {
  console.log(`OpenClaw Console server running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
