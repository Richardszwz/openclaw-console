/**
 * @fileoverview OpenClaw Web Console - Alert Notifications
 * Provides notification integration for alerts, including Feishu Webhook
 * 
 * @author OpenClaw Team
 * @license MIT
 */

import db from './database';
import https from 'https';
import http from 'http';
import url from 'url';

/**
 * Supported notification types
 */
export type NotificationType = 'feishu';

/**
 * Feishu webhook card message structure
 */
interface FeishuCardElement {
  tag: string;
  text?: {
    content: string;
  };
}

interface FeishuCardContent {
  config: {
    wide_screen_mode: boolean;
  };
  header: {
    title: {
      tag: 'plain_text';
      content: string;
    };
  };
  elements: FeishuCardElement[];
}

/**
 * Notification configuration from database
 */
export interface NotificationConfig {
  id: number;
  type: NotificationType;
  webhookUrl: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Alert information for notification
 */
export interface AlertNotification {
  ruleName: string;
  alertType: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  triggeredAt: string;
  source?: string;
}

/**
 * Get all enabled notification configurations
 */
export function getEnabledNotificationConfigs(): NotificationConfig[] {
  const rows = db.prepare(`
    SELECT id, type, webhook_url, enabled, created_at, updated_at
    FROM notification_settings
    WHERE enabled = 1
  `).all() as Array<{
    id: number;
    type: string;
    webhook_url: string;
    enabled: number;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    type: row.type as NotificationType,
    webhookUrl: row.webhook_url,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Send notification to Feishu via webhook
 */
async function sendFeishuNotification(webhookUrl: string, alert: AlertNotification): Promise<boolean> {
  return new Promise((resolve) => {
    // Map alert level to appropriate title color
    let title = 'OpenClaw 告警通知';
    switch (alert.level) {
      case 'critical':
        title = '🔴 OpenClaw 严重告警';
        break;
      case 'warning':
        title = '🟠 OpenClaw 警告';
        break;
      case 'info':
        title = '🔵 OpenClaw 通知';
        break;
    }

    // Build Feishu interactive card
    const card: FeishuCardContent = {
      config: {
        wide_screen_mode: true,
      },
      header: {
        title: {
          tag: 'plain_text',
          content: title,
        },
      },
      elements: [
        {
          tag: 'markdown',
          text: {
            content: `**告警规则:** ${alert.ruleName}\n\n**告警类型:** ${alert.alertType}\n\n**告警信息:** ${alert.message}\n\n**触发时间:** ${alert.triggeredAt}`,
          },
        },
      ],
    };

    if (alert.source) {
      card.elements.push({
        tag: 'markdown',
        text: {
          content: `**来源:** ${alert.source}`,
        },
      });
    }

    const payload = JSON.stringify({
      msg_type: 'interactive',
      card: card,
    });

    const parsedUrl = url.parse(webhookUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const requester = parsedUrl.protocol === 'https:' ? https : http;
    const req = requester.request(options, (res) => {
      let response = '';
      res.on('data', (chunk) => {
        response += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log('Feishu notification sent successfully');
          resolve(true);
        } else {
          console.error(`Feishu notification failed with status ${res.statusCode}: ${response}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error sending Feishu notification:', error);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Send alert notification to all configured channels
 */
export async function sendAlertNotification(alert: AlertNotification): Promise<void> {
  const configs = getEnabledNotificationConfigs();
  
  const promises = configs.map(async (config) => {
    if (config.type === 'feishu') {
      return sendFeishuNotification(config.webhookUrl, alert);
    }
    return false;
  });

  await Promise.all(promises);
}

/**
 * Add or update notification configuration
 */
export function saveNotificationConfig(
  type: NotificationType,
  webhookUrl: string,
  enabled: boolean = true
): NotificationConfig {
  const existing = db.prepare(`
    SELECT id FROM notification_settings WHERE type = ?
  `).get(type) as { id: number } | undefined;

  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE notification_settings
      SET webhook_url = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(webhookUrl, enabled ? 1 : 0, now, existing.id);

    return {
      id: existing.id,
      type,
      webhookUrl,
      enabled,
      createdAt: '', // We don't fetch the original created date here
      updatedAt: now,
    };
  } else {
    const result = db.prepare(`
      INSERT INTO notification_settings (type, webhook_url, enabled)
      VALUES (?, ?, ?)
    `).run(type, webhookUrl, enabled ? 1 : 0);

    return {
      id: Number(result.lastInsertRowid),
      type,
      webhookUrl,
      enabled,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/**
 * Get notification configuration by type
 */
export function getNotificationConfig(type: NotificationType): NotificationConfig | null {
  const row = db.prepare(`
    SELECT id, type, webhook_url, enabled, created_at, updated_at
    FROM notification_settings
    WHERE type = ?
  `).get(type) as {
    id: number;
    type: string;
    webhook_url: string;
    enabled: number;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    type: row.type as NotificationType,
    webhookUrl: row.webhook_url,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Delete notification configuration
 */
export function deleteNotificationConfig(id: number): boolean {
  const result = db.prepare(`
    DELETE FROM notification_settings WHERE id = ?
  `).run(id);

  return result.changes > 0;
}
