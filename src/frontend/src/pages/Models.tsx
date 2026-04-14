/**
 * @fileoverview Models page - Display model configuration, usage and quota information
 * @author OpenClaw Team
 * @license MIT
 */
import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import './Models.css';

/**
 * Daily usage record from API
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
 * Monthly cost record from API
 */
export interface MonthlyCost {
  month: string;
  modelId: string;
  totalTokens: number;
  totalCost: number;
}

/**
 * Quota alert record
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
 * Model cost configuration
 */
export interface ModelCost {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Model information matching backend API
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
 * API response types
 */
interface ModelsResponse {
  models: ModelInfo[];
  total: number;
}

interface UsageResponse {
  usage: ModelUsage[];
}

interface QuotasResponse {
  quotas: QuotaConfig[];
}

interface DailyUsageResponse {
  dailyUsage: DailyUsage[];
}

interface MonthlyCostResponse {
  monthlyCost: MonthlyCost[];
}

interface QuotaAlertsResponse {
  alerts: QuotaAlert[];
}

interface CheckQuotaResponse {
  checked: number;
  warnings: number;
  criticals: number;
  alertsSent: number;
}

/**
 * Props for Models component
 */
interface ModelsProps {
  // No props needed currently
}

/**
 * Format number with thousands separators
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format tokens to readable format (K, M)
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return formatNumber(tokens);
}

/**
 * Format cost in USD
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Calculate usage percentage
 */
function getUsagePercentage(totalTokens: number, quota: number): number {
  if (!quota || quota <= 0) {
    return 0;
  }
  return Math.min((totalTokens / quota) * 100, 100);
}

/**
 * Get progress bar color based on percentage
 */
function getProgressBarColor(percentage: number): string {
  if (percentage < 50) {
    return 'progress-green';
  } else if (percentage < 80) {
    return 'progress-yellow';
  } else {
    return 'progress-red';
  }
}

/**
 * Get status badge class
 */
function getStatusBadgeClass(hasApiKey: boolean): string {
  return `status-badge ${hasApiKey ? 'status-configured' : 'status-missing'}`;
}

/**
 * Get status text
 */
function getStatusText(hasApiKey: boolean): string {
  return hasApiKey ? 'Configured' : 'API Key Missing';
}

/**
 * Models page component
 * Displays all configured models with usage statistics and quota information
 */
export function Models({}: ModelsProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [usage, setUsage] = useState<ModelUsage[]>([]);
  const [quotas, setQuotas] = useState<QuotaConfig[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [monthlyCost, setMonthlyCost] = useState<MonthlyCost[]>([]);
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [editingQuotas, setEditingQuotas] = useState(false);
  const [localQuotas, setLocalQuotas] = useState<QuotaConfig[]>([]);
  const [checkingQuota, setCheckingQuota] = useState(false);

  /**
   * Fetch authorization headers
   */
  const getHeaders = (): HeadersInit => {
    const apiToken = import.meta.env.VITE_API_TOKEN;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }

    return headers;
  };

  /**
   * Fetch all data from API
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch models
      const modelsResponse = await fetch('/api/models', { headers: getHeaders() });
      if (!modelsResponse.ok) {
        throw new Error(`HTTP error: ${modelsResponse.status} ${modelsResponse.statusText}`);
      }
      const modelsData: ModelsResponse = await modelsResponse.json();
      setModels(modelsData.models);

      // Fetch usage
      const usageResponse = await fetch('/api/models/usage', { headers: getHeaders() });
      if (!usageResponse.ok) {
        throw new Error(`HTTP error: ${usageResponse.status} ${usageResponse.statusText}`);
      }
      const usageData: UsageResponse = await usageResponse.json();
      setUsage(usageData.usage);

      // Fetch quotas
      const quotasResponse = await fetch('/api/models/quotas', { headers: getHeaders() });
      if (!quotasResponse.ok) {
        throw new Error(`HTTP error: ${quotasResponse.status} ${quotasResponse.statusText}`);
      }
      const quotasData: QuotasResponse = await quotasResponse.json();
      setQuotas(quotasData.quotas);
      setLocalQuotas(quotasData.quotas);

      // Fetch daily usage for charts
      const dailyResponse = await fetch('/api/models/daily-usage', { headers: getHeaders() });
      if (dailyResponse.ok) {
        const dailyData: DailyUsageResponse = await dailyResponse.json();
        setDailyUsage(dailyData.dailyUsage);
      }

      // Fetch monthly cost for charts
      const monthlyResponse = await fetch('/api/models/monthly-cost', { headers: getHeaders() });
      if (monthlyResponse.ok) {
        const monthlyData: MonthlyCostResponse = await monthlyResponse.json();
        setMonthlyCost(monthlyData.monthlyCost);
      }

      // Fetch quota alert history
      const alertsResponse = await fetch('/api/models/quota-alerts', { headers: getHeaders() });
      if (alertsResponse.ok) {
        const alertsData: QuotaAlertsResponse = await alertsResponse.json();
        setAlerts(alertsData.alerts);
      }

      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch models data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check quotas and trigger alerts manually
   */
  const checkQuotas = async () => {
    try {
      setCheckingQuota(true);
      const response = await fetch('/api/models/check-quota', { headers: getHeaders() });
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      const result: CheckQuotaResponse = await response.json();
      console.log('Quota check result:', result);
      
      // Refresh alerts after check
      const alertsResponse = await fetch('/api/models/quota-alerts', { headers: getHeaders() });
      if (alertsResponse.ok) {
        const alertsData: QuotaAlertsResponse = await alertsResponse.json();
        setAlerts(alertsData.alerts);
      }
      
      alert(`Quota check completed:\nChecked: ${result.checked}\nWarnings: ${result.warnings}\nCritical: ${result.criticals}\nAlerts sent: ${result.alertsSent}`);
    } catch (err) {
      console.error('Failed to check quotas:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCheckingQuota(false);
    }
  };

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchData();
  }, []);

  /**
   * Save quota changes
   */
  const saveQuotas = async () => {
    try {
      const response = await fetch('/api/models/quotas', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ quotas: localQuotas }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const data: QuotasResponse = await response.json();
      setQuotas(data.quotas);
      setEditingQuotas(false);
      setError(null);
    } catch (err) {
      console.error('Failed to save quotas:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  /**
   * Cancel quota editing
   */
  const cancelQuotas = () => {
    setLocalQuotas([...quotas]);
    setEditingQuotas(false);
  };

  /**
   * Update local quota
   */
  const updateLocalQuota = (modelId: string, field: keyof QuotaConfig, value: any) => {
    const updatedQuotas = localQuotas.map(q => {
      if (q.modelId === modelId) {
        return { ...q, [field]: value };
      }
      return q;
    });
    setLocalQuotas(updatedQuotas);
  };

  /**
   * Get usage for a specific model
   */
  const getUsageForModel = (modelId: string): ModelUsage | null => {
    return usage.find(u => u.modelId === modelId) || null;
  };

  /**
   * Get quota for a specific model
   */
  const getQuotaForModel = (modelId: string): QuotaConfig | null => {
    const targetQuotas = editingQuotas ? localQuotas : quotas;
    return targetQuotas.find(q => q.modelId === modelId) || null;
  };

  /**
   * Get daily usage trend chart option
   */
  const getDailyUsageChartOption = () => {
    // Aggregate by date
    const aggregatedByDate = new Map<string, number>();
    dailyUsage.forEach(item => {
      const current = aggregatedByDate.get(item.date) || 0;
      aggregatedByDate.set(item.date, current + item.totalTokens);
    });

    const dates = Array.from(aggregatedByDate.keys()).sort();
    const values = dates.map(date => aggregatedByDate.get(date)!);

    return {
      title: {
        text: '近30天用量趋势',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: dates
      },
      yAxis: {
        type: 'value',
        name: 'Tokens'
      },
      series: [{
        name: '总用量',
        type: 'line',
        data: values,
        smooth: true,
        areaStyle: {
          opacity: 0.3
        }
      }]
    };
  };

  /**
   * Get model usage pie chart option
   */
  const getModelUsagePieOption = () => {
    // Aggregate by model
    const aggregatedByModel = new Map<string, number>();
    dailyUsage.forEach(item => {
      const current = aggregatedByModel.get(item.modelId) || 0;
      aggregatedByModel.set(item.modelId, current + item.totalTokens);
    });

    const data = Array.from(aggregatedByModel.entries()).map(([modelId, value]) => {
      const model = models.find(m => m.fullId === modelId);
      return {
        name: model?.name || modelId,
        value: value
      };
    });

    return {
      title: {
        text: '模型用量分布',
        left: 'center'
      },
      tooltip: {
        trigger: 'item'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [{
        name: '用量',
        type: 'pie',
        radius: '50%',
        data: data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };
  };

  /**
   * Get monthly cost trend chart option
   */
  const getMonthlyCostChartOption = () => {
    // Aggregate by month and model
    const months = Array.from(new Set(monthlyCost.map(item => item.month))).sort();
    const modelsSet = Array.from(new Set(monthlyCost.map(item => item.modelId)));
    
    const series = modelsSet.map(modelId => {
      const model = models.find(m => m.fullId === modelId);
      const data = months.map(month => {
        const item = monthlyCost.find(i => i.month === month && i.modelId === modelId);
        return item?.totalCost || 0;
      });

      return {
        name: model?.name || modelId,
        type: 'line',
        data: data,
        smooth: true
      };
    });

    return {
      title: {
        text: '月度成本趋势',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: modelsSet.map(modelId => {
          const model = models.find(m => m.fullId === modelId);
          return model?.name || modelId;
        }),
        bottom: 0
      },
      xAxis: {
        type: 'category',
        data: months
      },
      yAxis: {
        type: 'value',
        name: 'Cost (USD)'
      },
      series: series
    };
  };

  /**
   * Get alert badge class
   */
  const getAlertBadgeClass = (alertType: 'warning' | 'critical'): string => {
    return `alert-badge ${alertType === 'warning' ? 'alert-warning' : 'alert-critical'}`;
  };

  if (loading) {
    return (
      <div className="models-page">
        <div className="models-loading">Loading models...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="models-page">
        <div className="models-error">
          <div>Failed to load models: {error}</div>
          <button className="retry-btn" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="models-page">
      <div className="models-header">
        <h1 className="models-title">Models</h1>
        <div className="models-actions">
          <span className="refresh-info">
            Last refreshed at {lastRefreshed.toLocaleTimeString()}
          </span>
          {!editingQuotas ? (
            <>
              <button className="refresh-btn" onClick={fetchData}>Refresh</button>
              <button className="check-quota-btn" onClick={checkQuotas} disabled={checkingQuota}>
                {checkingQuota ? 'Checking...' : 'Check Quotas'}
              </button>
              <button className="edit-btn" onClick={() => setEditingQuotas(true)}>Edit Quotas</button>
            </>
          ) : (
            <>
              <button className="save-btn" onClick={saveQuotas}>Save</button>
              <button className="cancel-btn" onClick={cancelQuotas}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="models-table-container">
        <table className="models-table">
          <thead>
            <tr>
              <th>Model Name</th>
              <th>Platform</th>
              <th>Status</th>
              <th>Context Window</th>
              <th>Usage (Tokens)</th>
              <th>Est. Cost</th>
              <th>Quota Usage</th>
              {editingQuotas && <th>Monthly Quota (Tokens)</th>}
              {editingQuotas && <th>Monthly Budget (USD)</th>}
            </tr>
          </thead>
          <tbody>
            {models.map(model => {
              const modelUsage = getUsageForModel(model.fullId);
              const quota = getQuotaForModel(model.fullId);
              const totalTokens = modelUsage?.totalTokens || 0;
              const quotaTokens = quota?.enabled ? quota.monthlyQuotaTokens : 0;
              const percentage = quota?.enabled ? getUsagePercentage(totalTokens, quotaTokens) : 0;
              const progressClass = getProgressBarColor(percentage);

              return (
                <tr key={model.fullId}>
                  <td>
                    <div className="model-name">
                      {model.name}
                      <div className="model-id">{model.fullId}</div>
                    </div>
                  </td>
                  <td>{model.providerName}</td>
                  <td>
                    <span className={getStatusBadgeClass(model.hasApiKey)}>
                      {getStatusText(model.hasApiKey)}
                    </span>
                  </td>
                  <td>{formatTokens(model.contextWindow)}</td>
                  <td>{modelUsage ? formatTokens(modelUsage.totalTokens) : '-'}</td>
                  <td>{modelUsage ? formatCost(modelUsage.estimatedCost) : '-'}</td>
                  <td>
                    {quota?.enabled ? (
                      <div className="progress-container">
                        <div className="progress-bar">
                          <div 
                            className={`progress-fill ${progressClass}`} 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="progress-text">{percentage.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <span className="no-quota">No quota set</span>
                    )}
                  </td>
                  {editingQuotas && (
                    <td>
                      <input
                        type="number"
                        className="quota-input"
                        value={quota?.monthlyQuotaTokens || 0}
                        onChange={(e) => updateLocalQuota(model.fullId, 'monthlyQuotaTokens', Number(e.target.value))}
                      />
                    </td>
                  )}
                  {editingQuotas && (
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="budget-input"
                        value={quota?.monthlyBudgetUSD || 0}
                        onChange={(e) => updateLocalQuota(model.fullId, 'monthlyBudgetUSD', Number(e.target.value))}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Charts Section */}
      {dailyUsage.length > 0 && (
        <div className="charts-section">
          <div className="charts-row">
            <div className="chart-container">
              <ReactECharts 
                option={getDailyUsageChartOption()} 
                style={{ height: '400px', width: '100%' }} 
              />
            </div>
            <div className="chart-container">
              <ReactECharts 
                option={getModelUsagePieOption()} 
                style={{ height: '400px', width: '100%' }} 
              />
            </div>
          </div>
          {monthlyCost.length > 0 && (
            <div className="charts-row">
              <div className="chart-container full-width">
                <ReactECharts 
                  option={getMonthlyCostChartOption()} 
                  style={{ height: '400px', width: '100%' }} 
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alert History Section */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <h2 className="alerts-title">Quota Alert History</h2>
          <div className="alerts-table-container">
            <table className="alerts-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Model</th>
                  <th>Type</th>
                  <th>Usage</th>
                  <th>Quota</th>
                  <th>Percentage</th>
                  <th>Message</th>
                  <th>Notified</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert.id}>
                    <td>{new Date(alert.sentAt).toLocaleString()}</td>
                    <td>{alert.modelName} ({alert.modelId})</td>
                    <td>
                      <span className={getAlertBadgeClass(alert.alertType)}>
                        {alert.alertType === 'warning' ? 'Warning' : 'Critical'}
                      </span>
                    </td>
                    <td>{formatTokens(alert.currentUsage)}</td>
                    <td>{formatTokens(alert.quota)}</td>
                    <td>{alert.percentage.toFixed(1)}%</td>
                    <td>{alert.message}</td>
                    <td>{alert.notified ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="models-footer">
        <div className="models-stats">
          <span>Total models: {models.length}</span>
          <span>Configured: {models.filter(m => m.hasApiKey).length}</span>
          <span>With quota: {quotas.filter(q => q.enabled).length}</span>
          {alerts.length > 0 && <span>Alerts: {alerts.length}</span>}
        </div>
      </div>
    </div>
  );
}

export default Models;
