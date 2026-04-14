/**
 * Workflow API endpoints for Workflow Studio
 * Handles saving, loading, and retrieving workflows
 */

import { Request, Response } from 'express';
import { db } from './database';

// Initialize workflows table and execution history table
export function initWorkflowsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workflows_updated ON workflows(updated_at);
  `);

  // Create execution history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      current_node TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_executions_workflow ON workflow_executions(workflow_id);
  `);
}

/**
 * Workflow data structure from database
 */
interface WorkflowRow {
  id: number;
  name: string;
  description: string | null;
  nodes: string;
  edges: string;
  created_at: string;
  updated_at: string;
}

/**
 * Execution history row from database
 */
interface ExecutionRow {
  id: number;
  start_time: string;
  end_time: string | null;
  status: string;
  duration_ms: number | null;
  current_node: string | null;
}

/**
 * GET /api/workflows
 * Get all workflows
 */
export function getAllWorkflows(req: Request, res: Response): Response {
  try {
    const workflows = db.prepare(`
      SELECT id, name, description, created_at, updated_at
      FROM workflows
      ORDER BY updated_at DESC
    `).all();

    return res.json({
      success: true,
      data: workflows
    });
  } catch (error) {
    console.error('Error getting workflows:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve workflows'
    });
  }
}

/**
 * GET /api/workflows/:id
 * Get a single workflow by ID
 */
export function getWorkflowById(req: Request, res: Response): Response {
  try {
    const { id } = req.params;
    const workflow = db.prepare(`
      SELECT id, name, description, nodes, edges, created_at, updated_at
      FROM workflows
      WHERE id = ?
    `).get(id);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    // Parse JSON fields
    const wf = workflow as WorkflowRow;
    const parsedWorkflow = {
      ...wf,
      nodes: JSON.parse(wf.nodes),
      edges: JSON.parse(wf.edges)
    };

    return res.json({
      success: true,
      data: parsedWorkflow
    });
  } catch (error) {
    console.error('Error getting workflow:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve workflow'
    });
  }
}

/**
 * POST /api/workflows
 * Create or update a workflow
 */
export function createWorkflow(req: Request, res: Response): Response {
  try {
    const { name, description = '', nodes, edges } = req.body;

    if (!name || !nodes || !edges) {
      return res.status(400).json({
        success: false,
        error: 'Name, nodes, and edges are required'
      });
    }

    const nodesJson = JSON.stringify(nodes);
    const edgesJson = JSON.stringify(edges);

    const result = db.prepare(`
      INSERT INTO workflows (name, description, nodes, edges)
      VALUES (?, ?, ?, ?)
    `).run(name, description, nodesJson, edgesJson);

    return res.status(201).json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        name,
        description,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create workflow'
    });
  }
}

/**
 * PUT /api/workflows/:id
 * Update an existing workflow
 */
export function updateWorkflow(req: Request, res: Response): Response {
  try {
    const { id } = req.params;
    const { name, description, nodes, edges } = req.body;

    // Check if workflow exists
    const existing = db.prepare('SELECT id FROM workflows WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    const nodesJson = nodes ? JSON.stringify(nodes) : undefined;
    const edgesJson = edges ? JSON.stringify(edges) : undefined;

    // Build dynamic update query
    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: (string | number)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (nodesJson !== undefined) {
      updates.push('nodes = ?');
      params.push(nodesJson);
    }
    if (edgesJson !== undefined) {
      updates.push('edges = ?');
      params.push(edgesJson);
    }

    params.push(Number(id));

    db.prepare(`
      UPDATE workflows
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(params);

    return res.json({
      success: true,
      data: { id: Number(id) }
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update workflow'
    });
  }
}

/**
 * DELETE /api/workflows/:id
 * Delete a workflow
 */
export function deleteWorkflow(req: Request, res: Response): Response {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM workflows WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    // Also delete execution history
    db.prepare('DELETE FROM workflow_executions WHERE workflow_id = ?').run(id);
    db.prepare('DELETE FROM workflows WHERE id = ?').run(id);

    return res.json({
      success: true,
      data: { id: Number(id) }
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete workflow'
    });
  }
}

/**
 * GET /api/workflows/:id/history
 * Get execution history for a workflow
 */
export function getWorkflowExecutionHistory(req: Request, res: Response): Response {
  try {
    const { id } = req.params;
    
    // Check if workflow exists
    const existing = db.prepare('SELECT id FROM workflows WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    // Get execution history
    const executions = db.prepare(`
      SELECT id, start_time, end_time, status, duration_ms, current_node
      FROM workflow_executions
      WHERE workflow_id = ?
      ORDER BY created_at DESC
    `).all(id);

    // Format response
    const formattedHistory = (executions as ExecutionRow[]).map(exec => ({
      id: `exec-${exec.id}`,
      startTime: exec.start_time,
      endTime: exec.end_time,
      status: exec.status,
      duration: exec.duration_ms || 0,
      currentNode: exec.current_node
    }));

    // If no history in database, return mock data for demonstration
    if (formattedHistory.length === 0) {
      interface MockExecution {
        id: string;
        startTime: string;
        endTime: string;
        status: 'completed' | 'error';
        duration: number;
        currentNode: string;
      }
      const mockHistory: MockExecution[] = [];
      const now = Date.now();
      
      // Add some mock historical data
      for (let i = 0; i < 3; i++) {
        const statuses: Array<'completed' | 'error'> = ['completed', 'completed', 'error'];
        mockHistory.push({
          id: `mock-exec-${i}`,
          startTime: new Date(now - (i + 1) * 3600000).toISOString(),
          endTime: new Date(now - (i + 1) * 3600000 + 120000).toISOString(),
          status: statuses[i],
          duration: 120000 - i * 20000,
          currentNode: i === 2 ? '3' : '6'
        });
      }
      
      return res.json({
        success: true,
        data: mockHistory
      });
    }

    return res.json({
      success: true,
      data: formattedHistory
    });
  } catch (error) {
    console.error('Error getting execution history:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve execution history'
    });
  }
}

/**
 * POST /api/workflows/:id/execute
 * Start a new workflow execution
 */
export function startWorkflowExecution(req: Request, res: Response): Response {
  try {
    const { id } = req.params;
    
    // Check if workflow exists
    const existing = db.prepare('SELECT id FROM workflows WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    const result = db.prepare(`
      INSERT INTO workflow_executions (workflow_id, status, current_node)
      VALUES (?, 'running', ?)
    `).run(id, '1');

    return res.status(201).json({
      success: true,
      data: {
        executionId: Number(result.lastInsertRowid),
        startTime: new Date().toISOString(),
        status: 'running'
      }
    });
  } catch (error) {
    console.error('Error starting workflow execution:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start workflow execution'
    });
  }
}

/**
 * PUT /api/workflows/:id/executions/:executionId
 * Update execution status
 */
export function updateWorkflowExecution(req: Request, res: Response): Response {
  try {
    const { id, executionId } = req.params;
    const { status, currentNode, endTime, durationMs } = req.body;

    const updates: string[] = [];
    const params: (string | number | undefined)[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (currentNode !== undefined) {
      updates.push('current_node = ?');
      params.push(currentNode);
    }
    if (endTime !== undefined) {
      updates.push('end_time = ?');
      params.push(endTime);
    }
    if (durationMs !== undefined) {
      updates.push('duration_ms = ?');
      params.push(durationMs);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }

    params.push(Number(id));
    params.push(Number(executionId));

    db.prepare(`
      UPDATE workflow_executions
      SET ${updates.join(', ')}
      WHERE workflow_id = ? AND id = ?
    `).run(params);

    return res.json({
      success: true,
      data: { executionId: Number(executionId) }
    });
  } catch (error) {
    console.error('Error updating workflow execution:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update workflow execution'
    });
  }
}
