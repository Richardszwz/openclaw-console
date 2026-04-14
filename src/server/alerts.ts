/**
 * @fileoverview OpenClaw Web Console - Alerts API
 * Provides REST API for alert management including rules, history, and silences
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import express from 'express';
import db from './database';

/**
 * Supported alert types
 */
export type AlertType = 'task-failed' | 'gateway-offline' | 'session-timeout' | 'agent-error' | 'quota-exceeded';

/**
 * Alert rule definition
 */
export interface AlertRule {
  id: number;
  name: string;
  type: AlertType;
  enabled: boolean;
  threshold?: number;
  durationThreshold?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Alert history entry
 */
export interface AlertHistoryEntry {
  id: number;
  ruleId?: number;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  source?: string;
  triggeredAt: string;
  resolvedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: number;
}

/**
 * Alert silence rule
 */
export interface AlertSilence {
  id: number;
  name: string;
  filter?: string;
  startsAt: string;
  endsAt: string;
  createdBy: number;
  enabled: boolean;
  createdAt: string;
}

/**
 * Express router for alerts API
 */
export const router = express.Router();

// ============================================================================
// Alert Rules API
// ============================================================================

/**
 * @api {get} /api/alerts/rules Get all alert rules
 * @apiName GetAlertRules
 * @apiGroup Alerts
 * @apiDescription Get all configured alert rules
 * @apiSuccess {Object[]} rules List of alert rules
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/alerts/rules
 */
router.get('/rules', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, name, type, enabled, threshold, duration_threshold, description, created_at, updated_at
      FROM alert_rules
      ORDER BY created_at DESC
    `).all() as Array<{
      id: number;
      name: string;
      type: string;
      enabled: number;
      threshold?: number;
      duration_threshold?: number;
      description?: string;
      created_at: string;
      updated_at: string;
    }>;

    const formattedRules: AlertRule[] = rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type as AlertType,
      enabled: Boolean(row.enabled),
      threshold: row.threshold,
      durationThreshold: row.duration_threshold,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ rules: formattedRules });
  } catch (error) {
    console.error('Error getting alert rules:', error);
    res.status(500).json({
      error: 'Failed to get alert rules',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @api {post} /api/alerts/rules Create a new alert rule
 * @apiName CreateAlertRule
 * @apiGroup Alerts
 * @apiDescription Create a new alert rule
 * @apiBody {String} name Rule name
 * @apiBody {String} type Alert type: task-failed, gateway-offline, session-timeout, agent-error
 * @apiBody {Boolean} enabled Whether the rule is enabled
 * @apiBody {Number} [threshold] Threshold for triggering alert
 * @apiBody {Number} [durationThreshold] Duration threshold in seconds
 * @apiBody {String} [description] Optional description
 * @apiSuccess {Object} rule Created rule details
 * @apiExample {curl} Example usage:
 *   curl -X POST -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
 *     http://localhost:3000/api/alerts/rules \
 *     -d '{"name": "Task Failure Alert", "type": "task-failed", "enabled": true, "threshold": 3}'
 */
router.post('/rules', (req, res) => {
  try {
    const { name, type, enabled = true, threshold, durationThreshold, description } = req.body;

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'name and type are required'
      });
    }

    // Validate alert type
    const allowedTypes: AlertType[] = ['task-failed', 'gateway-offline', 'session-timeout', 'agent-error', 'quota-exceeded'];
    if (!allowedTypes.includes(type as AlertType)) {
      return res.status(400).json({
        error: 'Invalid alert type',
        message: `Allowed types: ${allowedTypes.join(', ')}`
      });
    }

    const result = db.prepare(`
      INSERT INTO alert_rules (name, type, enabled, threshold, duration_threshold, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      type,
      enabled ? 1 : 0,
      threshold || null,
      durationThreshold || null,
      description ? description.trim() : null
    );

    const newRule: AlertRule = {
      id: Number(result.lastInsertRowid),
      name: name.trim(),
      type: type as AlertType,
      enabled: Boolean(enabled),
      threshold,
      durationThreshold,
      description: description ? description.trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    res.status(201).json({ rule: newRule });
  } catch (error) {
    console.error('Error creating alert rule:', error);
    res.status(500).json({
      error: 'Failed to create alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @api {put} /api/alerts/rules/:id Update an existing alert rule
 * @apiName UpdateAlertRule
 * @apiGroup Alerts
 * @apiDescription Update an existing alert rule
 * @apiParam {Number} id Rule ID
 * @apiBody {String} [name] Rule name
 * @apiBody {String} [type] Alert type
 * @apiBody {Boolean} [enabled] Whether the rule is enabled
 * @apiBody {Number} [threshold] Threshold
 * @apiBody {Number} [durationThreshold] Duration threshold
 * @apiBody {String} [description] Description
 * @apiSuccess {Object} rule Updated rule details
 * @apiExample {curl} Example usage:
 *   curl -X PUT -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
 *     http://localhost:3000/api/alerts/rules/1 \
 *     -d '{"enabled": false, "threshold": 5}'
 */
router.put('/rules/:id', (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const updates = req.body;

    // Check if rule exists
    const existing = db.prepare(`SELECT id FROM alert_rules WHERE id = ?`).get(ruleId) as { id: number } | undefined;
    if (!existing) {
      return res.status(404).json({
        error: 'Alert rule not found',
        message: `Rule with id ${ruleId} not found`
      });
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const params: (string | number)[] = [];

    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      params.push(updates.name.trim());
    }
    if (updates.type !== undefined) {
      const allowedTypes: AlertType[] = ['task-failed', 'gateway-offline', 'session-timeout', 'agent-error', 'quota-exceeded'];
      if (!allowedTypes.includes(updates.type as AlertType)) {
        return res.status(400).json({
          error: 'Invalid alert type',
          message: `Allowed types: ${allowedTypes.join(', ')}`
        });
      }
      updateFields.push('type = ?');
      params.push(updates.type);
    }
    if (updates.enabled !== undefined) {
      updateFields.push('enabled = ?');
      params.push(updates.enabled ? 1 : 0);
    }
    if (updates.threshold !== undefined) {
      updateFields.push('threshold = ?');
      params.push(updates.threshold);
    }
    if (updates.durationThreshold !== undefined) {
      updateFields.push('duration_threshold = ?');
      params.push(updates.durationThreshold);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      params.push(updates.description ? updates.description.trim() : null);
    }

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(ruleId);

    db.prepare(`UPDATE alert_rules SET ${updateFields.join(', ')} WHERE id = ?`).run(...params);

    // Get updated rule
    const row = db.prepare(`
      SELECT id, name, type, enabled, threshold, duration_threshold, description, created_at, updated_at
      FROM alert_rules WHERE id = ?
    `).get(ruleId) as {
      id: number;
      name: string;
      type: string;
      enabled: number;
      threshold?: number;
      duration_threshold?: number;
      description?: string;
      created_at: string;
      updated_at: string;
    };

    const formattedRule: AlertRule = {
      id: row.id,
      name: row.name,
      type: row.type as AlertType,
      enabled: Boolean(row.enabled),
      threshold: row.threshold,
      durationThreshold: row.duration_threshold,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.json({ rule: formattedRule });
  } catch (error) {
    console.error('Error updating alert rule:', error);
    res.status(500).json({
      error: 'Failed to update alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @api {delete} /api/alerts/rules/:id Delete an alert rule
 * @apiName DeleteAlertRule
 * @apiGroup Alerts
 * @apiDescription Delete an alert rule
 * @apiParam {Number} id Rule ID
 * @apiSuccess {String} message Success message
 * @apiExample {curl} Example usage:
 *   curl -X DELETE -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/alerts/rules/1
 */
router.delete('/rules/:id', (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const result = db.prepare(`DELETE FROM alert_rules WHERE id = ?`).run(ruleId);

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Alert rule not found',
        message: `Rule with id ${ruleId} not found`
      });
    }

    res.json({ message: 'Alert rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert rule:', error);
    res.status(500).json({
      error: 'Failed to delete alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// Alert History API
// ============================================================================

/**
 * @api {get} /api/alerts/history Get alert history
 * @apiName GetAlertHistory
 * @apiGroup Alerts
 * @apiDescription Get alert history with status
 * @apiSuccess {Object[]} history List of alert history entries
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/alerts/history
 */
router.get('/history', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, rule_id, message, status, source, triggered_at, resolved_at, acknowledged_at, acknowledged_by
      FROM alert_history
      ORDER BY triggered_at DESC
    `).all() as Array<{
      id: number;
      rule_id?: number;
      message: string;
      status: string;
      source?: string;
      triggered_at: string;
      resolved_at?: string;
      acknowledged_at?: string;
      acknowledged_by?: number;
    }>;

    const formattedHistory: AlertHistoryEntry[] = rows.map(row => ({
      id: row.id,
      ruleId: row.rule_id,
      message: row.message,
      status: row.status as 'active' | 'acknowledged' | 'resolved',
      source: row.source,
      triggeredAt: row.triggered_at,
      resolvedAt: row.resolved_at,
      acknowledgedAt: row.acknowledged_at,
      acknowledgedBy: row.acknowledged_by,
    }));

    res.json({ history: formattedHistory });
  } catch (error) {
    console.error('Error getting alert history:', error);
    res.status(500).json({
      error: 'Failed to get alert history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// Alert Silences API
// ============================================================================

/**
 * @api {get} /api/alerts/silences Get alert silence rules
 * @apiName GetAlertSilences
 * @apiGroup Alerts
 * @apiDescription Get all alert silence rules
 * @apiSuccess {Object[]} silences List of silence rules
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/alerts/silences
 */
router.get('/silences', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, name, filter, starts_at, ends_at, created_by, enabled, created_at
      FROM alert_silences
      ORDER BY created_at DESC
    `).all() as Array<{
      id: number;
      name: string;
      filter?: string;
      starts_at: string;
      ends_at: string;
      created_by: number;
      enabled: number;
      created_at: string;
    }>;

    const formattedSilences: AlertSilence[] = rows.map(row => ({
      id: row.id,
      name: row.name,
      filter: row.filter,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdBy: row.created_by,
      enabled: Boolean(row.enabled),
      createdAt: row.created_at,
    }));

    res.json({ silences: formattedSilences });
  } catch (error) {
    console.error('Error getting alert silences:', error);
    res.status(500).json({
      error: 'Failed to get alert silences',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @api {post} /api/alerts/silences Create a new alert silence
 * @apiName CreateAlertSilence
 * @apiGroup Alerts
 * @apiDescription Create a new alert silence rule
 * @apiBody {String} name Silence name
 * @apiBody {String} [filter] Filter for which alerts to silence
 * @apiBody {String} startsAt Start time ISO string
 * @apiBody {String} endsAt End time ISO string
 * @apiBody {Number} createdBy User ID who created this silence
 * @apiBody {Boolean} enabled Whether the silence is enabled
 * @apiSuccess {Object} silence Created silence details
 * @apiExample {curl} Example usage:
 *   curl -X POST -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
 *     http://localhost:3000/api/alerts/silences \
 *     -d '{
 *       "name": "Maintenance Window",
 *       "filter": "type=task-failed",
 *       "startsAt": "2024-01-01T00:00:00Z",
 *       "endsAt": "2024-01-01T06:00:00Z",
 *       "createdBy": 1,
 *       "enabled": true
 *     }'
 */
router.post('/silences', (req, res) => {
  try {
    const { name, filter, startsAt, endsAt, createdBy, enabled = true } = req.body;

    // Validate required fields
    if (!name || !startsAt || !endsAt || createdBy === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'name, startsAt, endsAt, and createdBy are required'
      });
    }

    const result = db.prepare(`
      INSERT INTO alert_silences (name, filter, starts_at, ends_at, created_by, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      filter || null,
      startsAt,
      endsAt,
      createdBy,
      enabled ? 1 : 0
    );

    const newSilence: AlertSilence = {
      id: Number(result.lastInsertRowid),
      name: name.trim(),
      filter: filter || undefined,
      startsAt,
      endsAt,
      createdBy: Number(createdBy),
      enabled: Boolean(enabled),
      createdAt: new Date().toISOString(),
    };

    res.status(201).json({ silence: newSilence });
  } catch (error) {
    console.error('Error creating alert silence:', error);
    res.status(500).json({
      error: 'Failed to create alert silence',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
