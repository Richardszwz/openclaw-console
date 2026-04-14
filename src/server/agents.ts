/**
 * @fileoverview OpenClaw Web Console - Agents API
 * Provides REST API for getting agent list and status
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import fs from 'fs';
import path from 'path';
import express from 'express';

/** Express router for agents API */
export const router = express.Router();

/** Path to OpenClaw configuration file */
const OPENCLAW_CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.openclaw',
  'openclaw.json'
);

/**
 * Agent information interface
 */
export interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  agentDir: string;
  model: string | { primary: string; fallbacks?: string[] };
  status: 'active' | 'idle' | 'unknown';
  lastActivity?: string;
  skills?: string[];
}

/**
 * OpenClaw configuration interface
 */
interface OpenClawConfig {
  agents: {
    list: AgentInfo[];
  };
}

/**
 * @api {get} /api/agents Get all agents
 * @apiName GetAgents
 * @apiGroup Agents
 * @apiDescription Get list of all configured agents with their status
 * @apiSuccess {AgentInfo[]} agents List of agents
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/agents
 */
router.get('/', (req, res) => {
  try {
    // Check if config file exists
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      return res.status(404).json({
        error: 'ConfigNotFound',
        message: 'OpenClaw configuration file not found'
      });
    }

    // Read and parse config file
    const configContent = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
    const config: OpenClawConfig = JSON.parse(configContent);

    // Process agent list - add status information
    const agents = config.agents.list.map(agent => {
      // For now, we consider all configured agents as idle
      // In future, we could check running processes for actual status
      const processedAgent: AgentInfo = {
        ...agent,
        status: 'idle' // Default to idle since we don't track running processes yet
      };

      // Extract primary model id for easier display
      if (typeof processedAgent.model === 'object' && processedAgent.model.primary) {
        // Keep the original object but also extract for convenience
        processedAgent.model = processedAgent.model.primary;
      }

      return processedAgent;
    });

    res.json({
      agents,
      total: agents.length
    });
  } catch (error) {
    console.error('Failed to read agents configuration:', error);
    res.status(500).json({
      error: 'ConfigReadError',
      message: error instanceof Error ? error.message : 'Unknown error reading configuration'
    });
  }
});

/**
 * @api {get} /api/agents/:id Get agent by ID
 * @apiName GetAgentById
 * @apiGroup Agents
 * @apiDescription Get detailed information about a specific agent
 * @apiParam {String} id Agent unique ID
 * @apiSuccess {AgentInfo} agent Agent detailed information
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/agents/agent-123
 */
router.get('/:id', (req, res) => {
  try {
    const agentId = req.params.id;

    // Check if config file exists
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      return res.status(404).json({
        error: 'ConfigNotFound',
        message: 'OpenClaw configuration file not found'
      });
    }

    // Read and parse config file
    const configContent = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
    const config: OpenClawConfig = JSON.parse(configContent);

    // Find agent by ID
    const agent = config.agents.list.find(a => a.id === agentId);

    if (!agent) {
      return res.status(404).json({
        error: 'AgentNotFound',
        message: `Agent with ID "${agentId}" not found`
      });
    }

    // Process agent information
    const processedAgent: AgentInfo = {
      ...agent,
      status: 'idle' // Default to idle
    };

    // Extract primary model id for easier display
    if (typeof processedAgent.model === 'object' && processedAgent.model.primary) {
      processedAgent.model = processedAgent.model.primary;
    }

    res.json({
      agent: processedAgent
    });
  } catch (error) {
    console.error('Failed to read agent information:', error);
    res.status(500).json({
      error: 'AgentReadError',
      message: error instanceof Error ? error.message : 'Unknown error reading agent information'
    });
  }
});

/**
 * Agent statistics interface
 */
export interface AgentStats {
  totalSessions: number;
  totalTokensUsed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  sessionCountLast7Days: number;
  tokensLast7Days: number;
}

/**
 * @api {get} /api/agents/:id/stats Get agent statistics
 * @apiName GetAgentStats
 * @apiGroup Agents
 * @apiDescription Get usage statistics for a specific agent
 * @apiParam {String} id Agent unique ID
 * @apiSuccess {AgentStats} stats Agent statistics including session count and token usage
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/agents/agent-123/stats
 */
router.get('/:id/stats', (req, res) => {
  try {
    const agentId = req.params.id;

    // Check if config file exists (to validate agent exists)
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      return res.status(404).json({
        error: 'ConfigNotFound',
        message: 'OpenClaw configuration file not found'
      });
    }

    // Read and parse config file to verify agent exists
    const configContent = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
    const config: OpenClawConfig = JSON.parse(configContent);
    const agentExists = config.agents.list.some(a => a.id === agentId);

    if (!agentExists) {
      return res.status(404).json({
        error: 'AgentNotFound',
        message: `Agent with ID "${agentId}" not found`
      });
    }

    // TODO: In the future, read actual statistics from database or log files
    // For now, return placeholder statistics
    const stats: AgentStats = {
      totalSessions: 0,
      totalTokensUsed: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      sessionCountLast7Days: 0,
      tokensLast7Days: 0
    };

    res.json({
      stats
    });
  } catch (error) {
    console.error('Failed to read agent statistics:', error);
    res.status(500).json({
      error: 'StatsReadError',
      message: error instanceof Error ? error.message : 'Unknown error reading agent statistics'
    });
  }
});
