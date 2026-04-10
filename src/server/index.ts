/**
 * @fileoverview OpenClaw Web Console - Express HTTP Server
 * Provides REST API for frontend and serves static assets
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { initDatabase } from './database';
import { router as gatewayRouter } from './gateway';

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
console.log('✅ Database initialized');

/**
 * Global Middleware
 * - express.json() parses JSON request bodies
 * - express.urlencoded() parses form data
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * @api {get} /api/status Get service status
 * @apiName GetStatus
 * @apiGroup System
 * @apiDescription Check if the service is running
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
 * Gateway status API routes
 */
app.use('/api/gateway', gatewayRouter);

/**
 * Production mode: serve static frontend files
 * In development, Vite dev server handles frontend
 */
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', '..', 'src', 'frontend', 'dist');
  app.use(express.static(frontendDist));

  // Handle SPA routing - all non-API requests send index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

/**
 * Start the Express server
 * Listens on configured HOST:PORT
 * @api public
 */
app.listen(Number(PORT), HOST, () => {
  console.log(`🚀 OpenClaw Console server running on http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
