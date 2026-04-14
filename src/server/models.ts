/**
 * @fileoverview OpenClaw Web Console - Model Management API
 * Provides model configuration, usage statistics, and quota management
 * 
 * @author OpenClaw Team
 * @license MIT
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import db from './database';
import { sendAlertNotification } from './notifications';

/**
 * Model cost configuration (per million tokens)
 */
export interface ModelCost {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Model information from configuration
 */
export interface ModelConfig {
  id: string;
  name: string;
  api: string;
  reasoning: boolean;
  input: string[];
  cost: ModelCost;
  contextWindow: number;
  maxTokens: number;
}

/**
 * Provider information from configuration
 */
export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  api: string;
  authHeader?: boolean;
  models: ModelConfig[];
}

/**
 * OpenClaw configuration structure
 */
interface OpenClawConfig {
  models: {
    mode: string;
    providers: Record<string, ProviderConfig>;
  };
}

/**
 * Model information returned to frontend (without exposing API key)
 */
export interface ModelInfo {
  id: string;
  fullId: string;
  name: string;
  provider: string;
  providerName: string;
  hasApiKey: boolean;
  api: string;
  reasoning: boolean;
  inputTypes: string[];
  cost: ModelCost;
  contextWindow: number;
  maxTokens: number;
}

/**
 * Usage statistics for a model
 */
export interface ModelUsage {
  modelId: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  lastUpdated: string;
}

/**
 * Quota configuration
 */
export interface QuotaConfig {
  modelId: string;
  monthlyQuotaTokens: number;
  monthlyBudgetUSD: number;
  enabled: boolean;
}

/**
 * Default price configuration (per million tokens) for common providers
 */
const DEFAULT_PRICING: Record<string, ModelCost> = {
  'openai/gpt-4o': { input: 5.0, output: 15.0, cacheRead: 2.5, cacheWrite: 5.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0.15 },
  'anthropic/claude-3-5-sonnet': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.0 },
  'anthropic/claude-3-5-haiku': { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.0 },
  'google/gemini-1.5-pro': { input: 1.25, output: 3.75, cacheRead: 0.3125, cacheWrite: 1.25 },
  'google/gemini-1.5-flash': { input: 0.15, output: 0.75, cacheRead: 0.0375, cacheWrite: 0.15 },
  'volcengine/doubao': { input: 0.8, output: 2.4, cacheRead: 0.16, cacheWrite: 0.8 },
  'minimax/m2.7': { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0.375 },
};

/**
 * In-memory storage for quotas (will be persisted to database)
 */
const quotaConfigs: Record<string, QuotaConfig> = {};

/**
 * Read OpenClaw configuration from ~/.openclaw/openclaw.json
 */
function readOpenClawConfig(): OpenClawConfig {
  const configPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.openclaw',
    'openclaw.json'
  );

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as OpenClawConfig;
  } catch (error) {
    console.error('Failed to read OpenClaw config:', error);
    return { models: { mode: 'merge', providers: {} } };
  }
}

/**
 * Get friendly provider name from provider ID
 */
function getFriendlyProviderName(providerId: string): string {
  const lowerId = providerId.toLowerCase();
  if (lowerId.includes('volc') || lowerId.includes('doubao')) {
    return 'Volcengine (Doubao)';
  } else if (lowerId.includes('minimax')) {
    return 'MiniMax';
  } else if (lowerId.includes('openai')) {
    return 'OpenAI';
  } else if (lowerId.includes('anthropic')) {
    return 'Anthropic';
  } else if (lowerId.includes('google') || lowerId.includes('gemini')) {
    return 'Google Gemini';
  } else if (lowerId.includes('ollama')) {
    return 'Ollama (Local)';
  } else if (lowerId.includes('kimi') || lowerId.includes('moonshot')) {
    return 'Moonshot AI (Kimi)';
  } else if (lowerId.includes('vllm')) {
    return 'vLLM (Local)';
  }
  return providerId;
}

/**
 * Check if API key is configured
 */
function hasConfiguredApiKey(apiKey: string): boolean {
  if (!apiKey || apiKey.trim() === '') {
    return false;
  }
  // Check if it's a placeholder/env reference that hasn't been replaced
  if (apiKey.startsWith('${') && apiKey.endsWith('}')) {
    return false;
  }
  return true;
}

/**
 * Parse all models from configuration and prepare for frontend
 */
function getAllModels(): ModelInfo[] {
  const config = readOpenClawConfig();
  const models: ModelInfo[] = [];

  for (const [providerId, providerConfig] of Object.entries(config.models.providers)) {
    const providerName = getFriendlyProviderName(providerId);
    const hasKey = hasConfiguredApiKey(providerConfig.apiKey);

    for (const model of providerConfig.models) {
      // Use default pricing if not set
      const cost = model.cost || DEFAULT_PRICING[`${providerId}/${model.id}`] || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

      models.push({
        id: model.id,
        fullId: `${providerId}/${model.id}`,
        name: model.name,
        provider: providerId,
        providerName,
        hasApiKey: hasKey,
        api: model.api || providerConfig.api,
        reasoning: model.reasoning,
        inputTypes: model.input || ['text'],
        cost,
        contextWindow: model.contextWindow || 16384,
        maxTokens: model.maxTokens || 4096,
      });
    }
  }

  return models;
}



/**
 * Generate mock usage data when no API is available
 */
function generateMockUsage(models: ModelInfo[]): ModelUsage[] {
  const usages: ModelUsage[] = [];

  for (const model of models) {
    // Random usage between 0-80% of a typical quota
    const promptTokens = Math.floor(Math.random() * 1000000);
    const completionTokens = Math.floor(Math.random() * 500000);
    const totalTokens = promptTokens + completionTokens;

    // Calculate estimated cost
    let estimatedCost = 0;
    estimatedCost += (promptTokens / 1000000) * model.cost.input;
    estimatedCost += (completionTokens / 1000000) * model.cost.output;

    usages.push({
      modelId: model.fullId,
      provider: model.provider,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
      lastUpdated: new Date().toISOString(),
    });
  }

  return usages;
}

/**
 * Get all usage statistics
 */
async function getAllUsage(models: ModelInfo[]): Promise<ModelUsage[]> {
  // For now, use mock data since most providers don't have public usage APIs
  // In future, we can implement real API calls for providers that support it
  return generateMockUsage(models);
}

/**
 * Get all quota configurations
 */
function getAllQuotas(): QuotaConfig[] {
  // Initialize quotas for models that don't have it yet
  const models = getAllModels();
  for (const model of models) {
    if (!quotaConfigs[model.fullId]) {
      quotaConfigs[model.fullId] = {
        modelId: model.fullId,
        monthlyQuotaTokens: 1000000, // Default 1M tokens
        monthlyBudgetUSD: 10.0, // Default $10 budget
        enabled: false,
      };
    }
  }

  return Object.values(quotaConfigs);
}

/**
 * Update quota configurations
 */
function updateQuotas(updatedQuotas: QuotaConfig[]): QuotaConfig[] {
  for (const quota of updatedQuotas) {
    quotaConfigs[quota.modelId] = quota;
  }
  return getAllQuotas();
}

/**
 * Calculate estimated cost for given token counts
 */
function calculateEstimatedCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  cacheRead: number = 0,
  cacheWrite: number = 0
): number {
  const models = getAllModels();
  const model = models.find(m => m.fullId === modelId);

  if (!model) {
    return 0;
  }

  let cost = 0;
  cost += (promptTokens / 1000000) * model.cost.input;
  cost += (completionTokens / 1000000) * model.cost.output;
  cost += (cacheRead / 1000000) * model.cost.cacheRead;
  cost += (cacheWrite / 1000000) * model.cost.cacheWrite;

  return cost;
}

/**
 * Daily usage record for trending
 */
export interface DailyUsage {
  date: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Monthly cost summary
 */
export interface MonthlyCost {
  month: string;
  modelId: string;
  totalTokens: number;
  totalCost: number;
}

/**
 * Model quota alert record
 */
export interface QuotaAlert {
  id: number;
  modelId: string;
  modelName: string;
  alertType: 'warning' | 'critical';
  currentUsage: number;
  quota: number;
  percentage: number;
  message: string;
  sentAt: string;
  notified: boolean;
}

/**
 * Express router for model API endpoints
 */
export const router = express.Router();

/**
 * @api {get} /api/models Get all configured models
 * @apiName GetModels
 * @apiGroup Models
 * @apiDescription Get information about all configured models (API keys not exposed)
 * @apiSuccess {ModelInfo[]} models List of all configured models
 * @apiSuccess {Number} total Total number of models
 * @apiExample {curl} Example usage:
 *   curl http://localhost:3000/api/models -H "Authorization: Bearer <token>"
 */
router.get('/', (req, res) => {
  const models = getAllModels();
  res.json({
    models,
    total: models.length,
  });
});

/**
 * @api {get} /api/models/usage Get usage statistics
 * @apiName GetModelUsage
 * @apiGroup Models
 * @apiDescription Get current usage statistics for all models (from provider APIs when available)
 * @apiSuccess {ModelUsage[]} usage Usage statistics for each model
 */
router.get('/usage', async (req, res) => {
  try {
    const models = getAllModels();
    const usage = await getAllUsage(models);
    res.json({ usage });
  } catch (error) {
    console.error('Failed to get model usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

/**
 * @api {get} /api/models/quotas Get quota configurations
 * @apiName GetModelQuotas
 * @apiGroup Models
 * @apiDescription Get current quota configurations for all models
 * @apiSuccess {QuotaConfig[]} quotas Quota configurations
 */
router.get('/quotas', (req, res) => {
  const quotas = getAllQuotas();
  res.json({ quotas });
});

/**
 * @api {put} /api/models/quotas Update quota configurations
 * @apiName UpdateModelQuotas
 * @apiGroup Models
 * @apiDescription Update quota configurations
 * @apiBody {QuotaConfig[]} quotas Updated quota configurations
 * @apiSuccess {QuotaConfig[]} quotas Updated quota configurations
 */
router.put('/quotas', (req, res) => {
  try {
    const { quotas: updatedQuotas } = req.body;
    const quotas = updateQuotas(updatedQuotas);
    res.json({ quotas });
  } catch (error) {
    console.error('Failed to update quotas:', error);
    res.status(500).json({ error: 'Failed to update quota configurations' });
  }
});

/**
 * @api {post} /api/models/calculate-cost Calculate estimated cost
 * @apiName CalculateCost
 * @apiGroup Models
 * @apiDescription Calculate estimated cost for given token counts
 * @apiBody {String} modelId Model full ID
 * @apiBody {Number} promptTokens Number of prompt tokens
 * @apiBody {Number} completionTokens Number of completion tokens
 * @apiBody {Number} cacheRead Cache read tokens (optional)
 * @apiBody {Number} cacheWrite Cache write tokens (optional)
 * @apiSuccess {Number} cost Estimated cost in USD
 */
router.post('/calculate-cost', (req, res) => {
  const { modelId, promptTokens, completionTokens, cacheRead, cacheWrite } = req.body;
  const cost = calculateEstimatedCost(modelId, promptTokens || 0, completionTokens || 0, cacheRead || 0, cacheWrite || 0);
  res.json({ cost });
});

/**
 * @api {get} /api/models/daily-usage Get daily usage for the last 30 days
 * @apiName GetDailyUsage
 * @apiGroup Models
 * @apiDescription Get daily usage statistics for all models for the last 30 days
 * @apiSuccess {DailyUsage[]} dailyUsage Daily usage records
 */
router.get('/daily-usage', async (req, res) => {
  try {
    // Generate 30 days of mock daily usage data
    const dailyUsage: DailyUsage[] = [];
    const models = getAllModels();
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      for (const model of models) {
        // Random daily usage
        const promptTokens = Math.floor(Math.random() * 50000);
        const completionTokens = Math.floor(Math.random() * 25000);
        const totalTokens = promptTokens + completionTokens;
        
        let estimatedCost = 0;
        estimatedCost += (promptTokens / 1000000) * model.cost.input;
        estimatedCost += (completionTokens / 1000000) * model.cost.output;
        
        dailyUsage.push({
          date: dateStr,
          modelId: model.fullId,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCost,
        });
      }
    }
    
    res.json({ dailyUsage });
  } catch (error) {
    console.error('Failed to get daily usage:', error);
    res.status(500).json({ error: 'Failed to fetch daily usage statistics' });
  }
});

/**
 * @api {get} /api/models/monthly-cost Get monthly cost summary
 * @apiName GetMonthlyCost
 * @apiGroup Models
 * @apiDescription Get monthly cost summary grouped by model
 * @apiSuccess {MonthlyCost[]} monthlyCost Monthly cost records
 */
router.get('/monthly-cost', async (req, res) => {
  try {
    // Generate 6 months of mock monthly cost data
    const monthlyCost: MonthlyCost[] = [];
    const models = getAllModels();
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      for (const model of models) {
        // Random monthly usage
        const totalTokens = Math.floor(Math.random() * 1000000);
        const totalCost = (totalTokens / 1000000) * 
          ((model.cost.input + model.cost.output) / 2);
        
        monthlyCost.push({
          month: monthStr,
          modelId: model.fullId,
          totalTokens,
          totalCost,
        });
      }
    }
    
    res.json({ monthlyCost });
  } catch (error) {
    console.error('Failed to get monthly cost:', error);
    res.status(500).json({ error: 'Failed to fetch monthly cost summary' });
  }
});

/**
 * @api {get} /api/models/quota-alerts Get quota alert history
 * @apiName GetQuotaAlerts
 * @apiGroup Models
 * @apiDescription Get history of quota alerts
 * @apiSuccess {QuotaAlert[]} alerts Quota alert history
 */
router.get('/quota-alerts', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, model_id, model_name, alert_type, current_usage, quota, percentage, message, sent_at, notified
      FROM model_quota_alerts
      ORDER BY sent_at DESC
    `).all() as Array<{
      id: number;
      model_id: string;
      model_name: string;
      alert_type: string;
      current_usage: number;
      quota: number;
      percentage: number;
      message: string;
      sent_at: string;
      notified: number;
    }>;
    
    const alerts: QuotaAlert[] = rows.map(row => ({
      id: row.id,
      modelId: row.model_id,
      modelName: row.model_name,
      alertType: row.alert_type as 'warning' | 'critical',
      currentUsage: row.current_usage,
      quota: row.quota,
      percentage: row.percentage,
      message: row.message,
      sentAt: row.sent_at,
      notified: Boolean(row.notified),
    }));
    
    res.json({ alerts });
  } catch (error) {
    console.error('Failed to get quota alerts:', error);
    res.status(500).json({ error: 'Failed to fetch quota alert history' });
  }
});

/**
 * Check quota usage and trigger alerts if needed
 */
router.get('/check-quota', async (req, res) => {
  try {
    const result = await checkQuotaAlerts();
    res.json(result);
  } catch (error) {
    console.error('Failed to check quotas:', error);
    res.status(500).json({ error: 'Failed to check quota limits' });
  }
});

/**
 * Check all model quotas for usage exceeding thresholds
 */
export async function checkQuotaAlerts(): Promise<{
  checked: number;
  warnings: number;
  criticals: number;
  alertsSent: number;
}> {
  const models = getAllModels();
  const quotas = getAllQuotas();
  const currentUsage = await getAllUsage(models);
  
  let checked = 0;
  let warnings = 0;
  let criticals = 0;
  let alertsSent = 0;
  
  for (const quota of quotas) {
    if (!quota.enabled) continue;
    
    checked++;
    const model = models.find(m => m.fullId === quota.modelId);
    const usage = currentUsage.find(u => u.modelId === quota.modelId);
    const totalTokens = usage?.totalTokens || 0;
    const percentage = (totalTokens / quota.monthlyQuotaTokens) * 100;
    
    // Check if we've already sent an alert for this threshold today
        const today = new Date().toISOString().split('T')[0];
    const existingAlert = db.prepare(`
      SELECT id, alert_type FROM model_quota_alerts 
      WHERE model_id = ? AND DATE(sent_at) = DATE(?)
    `).get(quota.modelId, today) as { id: number; alert_type: string } | undefined;
    
    if (existingAlert) {
      // Already alerted today, skip
      continue;
    }
    
    let alertType: 'warning' | 'critical' | null = null;
    let message = '';
    
    if (percentage >= 100) {
      // Over quota - critical alert
      alertType = 'critical';
      message = `模型 ${model?.name || quota.modelId} 已超过配额限制。当前用量: ${totalTokens.toLocaleString()} tokens, 配额: ${quota.monthlyQuotaTokens.toLocaleString()} tokens (${percentage.toFixed(1)}%)`;
      criticals++;
    } else if (percentage >= 80) {
      // Warning - 80% threshold
      alertType = 'warning';
      message = `模型 ${model?.name || quota.modelId} 已使用 ${percentage.toFixed(1)}% 配额。当前用量: ${totalTokens.toLocaleString()} tokens, 配额: ${quota.monthlyQuotaTokens.toLocaleString()} tokens`;
      warnings++;
    }
    
    if (alertType) {
      // Record alert in database
      const result = db.prepare(`
        INSERT INTO model_quota_alerts (model_id, model_name, alert_type, current_usage, quota, percentage, message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        quota.modelId,
        model?.name || quota.modelId,
        alertType,
        totalTokens,
        quota.monthlyQuotaTokens,
        percentage,
        message
      );
      
      // Send notification via existing notification system
      await sendAlertNotification({
        ruleName: `配额${alertType === 'warning' ? '预警' : '超限告警'}`,
        alertType: 'quota-exceeded',
        message,
        level: alertType === 'warning' ? 'warning' : 'critical',
        triggeredAt: new Date().toISOString(),
        source: `model:${quota.modelId}`,
      });
      
      // Mark as notified
      db.prepare(`
        UPDATE model_quota_alerts SET notified = 1 WHERE id = ?
      `).run(result.lastInsertRowid);
      
      alertsSent++;
      console.log(`Quota alert sent: ${message}`);
    }
  }
  
  return { checked, warnings, criticals, alertsSent };
}
