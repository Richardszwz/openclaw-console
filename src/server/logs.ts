/**
 * @fileoverview Logs API endpoints
 * Provides log reading with filtering, pagination and streaming capabilities
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import express from 'express';
import fs from 'fs';
import path from 'path';

/** Router for logs endpoints */
const router = express.Router();

/** Log level type */
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'trace';

/** Maximum log file size to read in memory (100MB) to prevent OOM */
const MAX_LOG_FILE_SIZE = 100 * 1024 * 1024;

/** Log entry structure */
export interface LogEntry {
  timestamp: number;
  datetime: string;
  level: LogLevel;
  message: string;
  raw: string;
}

/** Log query parameters */
interface LogQuery {
  level?: LogLevel[];
  from?: number;
  to?: number;
  page: number;
  limit: number;
}

/** Default OpenClaw log paths */
const DEFAULT_LOG_PATHS = [
  process.env.OPENCLAW_LOG_FILE,
  path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw', 'logs', 'openclaw.log'),
  path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw', 'openclaw.log'),
  path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw', 'gateway.log'),
  path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw', 'logs', 'gateway.log'),
  '/var/log/openclaw/openclaw.log',
  '/var/log/openclaw/gateway.log',
].filter(Boolean) as string[];

/**
 * Parse a single log line into LogEntry
 * Supports common log formats:
 * - [2024-04-10 12:34:56] [INFO] Message
 * - 2024-04-10T12:34:56.123Z INFO Message
 * - [1712728496] [error] Message
 */
function parseLogLine(line: string): LogEntry | null {
  if (!line.trim()) return null;

  let timestamp: number;
  let datetime: string;
  let level: LogLevel = 'info';
  let message = line;

  // Try format: [2024-04-10 12:34:56] [INFO] Message
  const bracketMatch = line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)$/);
  if (bracketMatch) {
    const [, dateStr, levelStr, msg] = bracketMatch;
    datetime = dateStr;
    level = parseLevel(levelStr);
    message = msg;
    timestamp = new Date(dateStr).getTime();
    if (isNaN(timestamp)) {
      // Try as unix timestamp
      const ts = parseInt(dateStr, 10);
      if (!isNaN(ts)) {
        timestamp = dateStr.length === 10 ? ts * 1000 : ts;
        datetime = new Date(timestamp).toISOString();
      }
    }
    return { timestamp, datetime, level, message, raw: line };
  }

  // Try format: 2024-04-10T12:34:56.123Z INFO Message
  const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*)\s+(\w+)\s+(.*)$/);
  if (isoMatch) {
    const [, dateStr, levelStr, msg] = isoMatch;
    datetime = dateStr;
    level = parseLevel(levelStr);
    message = msg;
    timestamp = new Date(dateStr).getTime();
    return { timestamp, datetime, level, message, raw: line };
  }

  // Best effort: try to extract timestamp from beginning
  const dateStartMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*)/);
  if (dateStartMatch) {
    datetime = dateStartMatch[1];
    timestamp = new Date(datetime).getTime();
    message = line.slice(dateStartMatch[0].length).trim();
    // Check if next token is level
    const nextTokenMatch = message.match(/^(\w+)\s+/);
    if (nextTokenMatch && isLevel(nextTokenMatch[1])) {
      level = parseLevel(nextTokenMatch[1]);
      message = message.slice(nextTokenMatch[0].length).trim();
    }
    return { timestamp, datetime, level, message, raw: line };
  }

  // Fallback: use current time, info level
  timestamp = Date.now();
  datetime = new Date(timestamp).toISOString();
  return { timestamp, datetime, level, message, raw: line };
}

/**
 * Check if string is a valid log level
 */
function isLevel(s: string): boolean {
  const levels = new Set(['debug', 'info', 'warn', 'error', 'trace', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'TRACE']);
  return levels.has(s.toLowerCase());
}

/**
 * Parse log level from string
 */
function parseLevel(s: string): LogLevel {
  const lower = s.toLowerCase();
  switch (lower) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
    case 'trace':
      return lower;
    default:
      return 'info';
  }
}

/**
 * Find the first existing log file
 */
function findLogFile(): string | null {
  for (const logPath of DEFAULT_LOG_PATHS) {
    try {
      if (fs.existsSync(logPath) && fs.statSync(logPath).isFile()) {
        return logPath;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Parse query parameters from request
 */
function parseQuery(req: express.Request): LogQuery {
  const query: LogQuery = {
    page: 1,
    limit: 100,
  };

  // Parse level filter
  if (req.query.level) {
    const levelStr = String(req.query.level);
    query.level = levelStr.split(',').map(l => parseLevel(l.trim()));
  }

  // Parse time range
  if (req.query.from) {
    query.from = parseInt(String(req.query.from), 10);
  }
  if (req.query.to) {
    query.to = parseInt(String(req.query.to), 10);
  }

  // Parse pagination
  if (req.query.page) {
    query.page = Math.max(1, parseInt(String(req.query.page), 10));
  }
  if (req.query.limit) {
    query.limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit), 10)));
  }

  return query;
}

/**
 * Check if log entry matches filter criteria
 */
function matchesFilter(entry: LogEntry, query: LogQuery): boolean {
  // Level filter
  if (query.level && query.level.length > 0) {
    if (!query.level.includes(entry.level)) {
      return false;
    }
  }

  // From timestamp
  if (query.from && entry.timestamp < query.from) {
    return false;
  }

  // To timestamp
  if (query.to && entry.timestamp > query.to) {
    return false;
  }

  return true;
}

/**
 * @api {get} /api/logs Get logs
 * @apiName GetLogs
 * @apiGroup Logs
 * @apiDescription Get OpenClaw logs with filtering and pagination
 * @apiParam {String} [level] Filter by comma-separated log levels (debug,info,warn,error)
 * @apiParam {Number} [from] Filter entries after this timestamp (milliseconds)
 * @apiParam {Number} [to] Filter entries before this timestamp (milliseconds)
 * @apiParam {Number} [page=1] Page number
 * @apiParam {Number} [limit=100] Entries per page (max 1000)
 * @apiSuccess {LogEntry[]} entries Array of log entries
 * @apiSuccess {Number} total Total matching entries
 * @apiSuccess {Number} page Current page
 * @apiSuccess {Number} limit Entries per page
 * @apiSuccess {Number} totalPages Total number of pages
 * @apiSuccess {String} logPath Path to log file that was read
 * @apiError {String} error Error message
 */
router.get('/', async (req, res) => {
  try {
    const logPath = findLogFile();
    if (!logPath) {
      return res.status(404).json({ error: 'No log file found' });
    }

    // Check file size to prevent OOM
    const stat = fs.statSync(logPath);
    if (stat.size > MAX_LOG_FILE_SIZE) {
      return res.status(413).json({
        error: 'Log file too large',
        message: `Log file size exceeds maximum allowed size of ${MAX_LOG_FILE_SIZE / 1024 / 1024}MB. Use /api/logs/tail instead.`,
        fileSize: stat.size,
        maxSize: MAX_LOG_FILE_SIZE
      });
    }

    const query = parseQuery(req);
    const allEntries: LogEntry[] = [];

    const fileStream = fs.createReadStream(logPath, { encoding: 'utf8' });
    let remaining = '';

    await new Promise<void>((resolve, reject) => {
      fileStream.on('data', (chunk: string | Buffer) => {
        const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        const lines = (remaining + chunkStr).split('\n');
        remaining = lines.pop() || '';

        for (const line of lines) {
          const entry = parseLogLine(line);
          if (entry && matchesFilter(entry, query)) {
            allEntries.push(entry);
          }
        }
      });

      fileStream.on('end', () => {
        if (remaining) {
          const entry = parseLogLine(remaining);
          if (entry && matchesFilter(entry, query)) {
            allEntries.push(entry);
          }
        }
        resolve();
      });

      fileStream.on('error', reject);
    });

    // Sort by timestamp ascending (oldest first)
    allEntries.sort((a, b) => a.timestamp - b.timestamp);

    // Pagination
    const total = allEntries.length;
    const startIndex = (query.page - 1) * query.limit;
    const endIndex = startIndex + query.limit;
    const pagedEntries = allEntries.slice(startIndex, endIndex);
    const totalPages = Math.ceil(total / query.limit);

    res.json({
      entries: pagedEntries,
      total,
      page: query.page,
      limit: query.limit,
      totalPages,
      logPath,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to read logs:', message);
    res.status(500).json({ error: `Failed to read logs: ${message}` });
  }
});

/**
 * @api {get} /api/logs/tail Tail logs (newest entries first)
 * @apiName TailLogs
 * @apiGroup Logs
 * @apiDescription Get the most recent log entries (reverse order)
 * @apiParam {String} [level] Filter by comma-separated log levels
 * @apiParam {Number} [lines=100] Number of lines to return
 * @apiSuccess {LogEntry[]} entries Array of log entries (newest first)
 */
router.get('/tail', async (req, res) => {
  try {
    const logPath = findLogFile();
    if (!logPath) {
      return res.status(404).json({ error: 'No log file found' });
    }

    const lines = Math.min(500, Math.max(1, parseInt(String(req.query.lines || '100'), 10)));
    const levelFilter = req.query.level ? String(req.query.level).split(',').map(l => parseLevel(l.trim())) : null;

    // Read file from the end to get last N lines
    const stat = fs.statSync(logPath);
    const fileSize = stat.size;
    
    // Even for tailing, cap the maximum we read to prevent OOM
    const maxReadSize = Math.min(10 * 1024 * 1024, fileSize); // 10MB max read for tail
    const bufferSize = Math.min(64 * 1024, maxReadSize);
    let offset = Math.max(0, fileSize - maxReadSize);

    const entries: LogEntry[] = [];
    let content = '';

    // Read backwards until we have enough lines
    while (entries.length < lines && offset > 0) {
      const buffer = Buffer.alloc(bufferSize);
      const fd = fs.openSync(logPath, 'r');
      fs.readSync(fd, buffer, 0, bufferSize, offset);
      fs.closeSync(fd);
      content = buffer.toString() + content;

      const linesArr = content.split('\n').filter(l => l.trim());
      for (let i = linesArr.length - 1; i >= 0 && entries.length < lines; i--) {
        const entry = parseLogLine(linesArr[i]);
        if (entry) {
          if (!levelFilter || levelFilter.includes(entry.level)) {
            entries.push(entry);
          }
        }
      }

      offset -= bufferSize;
    }

    res.json({ entries, logPath });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to tail logs:', message);
    res.status(500).json({ error: `Failed to tail logs: ${message}` });
  }
});

export { router };
export default router;
