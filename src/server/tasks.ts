/**
 * @fileoverview OpenClaw Web Console - Tasks API
 * Provides REST API for cron job management
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import CronExpressionParser from 'cron-parser';

/**
 * Task definition from jobs.json
 */
export interface CronTask {
  id: string;
  name: string;
  cron: string;
  command: string;
  enabled: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Execution history entry
 */
export interface TaskExecution {
  id: string;
  taskId: string;
  startTime: string;
  endTime: string;
  status: 'success' | 'failed' | 'running';
  duration: number;
  output?: string;
  error?: string;
}

/**
 * Response with tasks and next execution times
 */
export interface TasksResponse {
  tasks: (CronTask & { nextRun: string | null })[];
}

/**
 * Get the path to the jobs.json file
 */
function getJobsJsonPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error('Could not determine home directory');
  }
  return path.join(homeDir, '.openclaw', 'cron', 'jobs.json');
}

/**
 * Get the path to the execution history file
 */
function getExecutionHistoryPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error('Could not determine home directory');
  }
  return path.join(homeDir, '.openclaw', 'cron', 'history.json');
}

/**
 * Read tasks from jobs.json
 */
function readTasks(): CronTask[] {
  const jobsPath = getJobsJsonPath();
  
  if (!fs.existsSync(jobsPath)) {
    // Create directory if it doesn't exist
    const dir = path.dirname(jobsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Create empty jobs.json
    fs.writeFileSync(jobsPath, JSON.stringify([], null, 2));
    return [];
  }

  try {
    const content = fs.readFileSync(jobsPath, 'utf-8');
    const parsed = JSON.parse(content);
    
    // Handle different JSON structures - some have { jobs: [...] }, others have [...] directly
    let jobsArray: Array<Record<string, unknown>>;
    if (Array.isArray(parsed)) {
      jobsArray = parsed;
    } else if (parsed.jobs && Array.isArray(parsed.jobs)) {
      jobsArray = parsed.jobs;
    } else {
      throw new Error('Invalid jobs.json structure: expected array or { jobs: [...] }');
    }
    
    // Transform job objects to CronTask format
    const tasks: CronTask[] = jobsArray.map((job: Record<string, unknown>) => ({
      id: String(job.id),
      name: String(job.name || 'Unnamed Task'),
      cron: (job.schedule as Record<string, unknown>)?.expr as string || job.cron as string || '',
      command: (job.payload as Record<string, unknown>)?.message as string || job.command as string || '',
      enabled: job.enabled !== false,
      description: job.description as string | undefined,
      createdAt: job.createdAtMs ? new Date(Number(job.createdAtMs)).toISOString() : (job.createdAt as string || new Date().toISOString()),
      updatedAt: job.updatedAtMs ? new Date(Number(job.updatedAtMs)).toISOString() : (job.updatedAt as string || new Date().toISOString()),
    }));
    
    return tasks;
  } catch (error) {
    console.error('Error reading jobs.json:', error);
    throw new Error(`Failed to read jobs.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Read execution history from history.json
 */
function readExecutionHistory(): TaskExecution[] {
  const historyPath = getExecutionHistoryPath();
  
  if (!fs.existsSync(historyPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(historyPath, 'utf-8');
    const history = JSON.parse(content) as TaskExecution[];
    return history;
  } catch (error) {
    console.error('Error reading history.json:', error);
    throw new Error(`Failed to read history.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate next run time from cron expression
 */
function getNextRunTime(cronExpression: string): string | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression);
    const nextDate = interval.next().toDate();
    return nextDate.toISOString();
  } catch (error) {
    console.error('Invalid cron expression:', cronExpression, error);
    return null;
  }
}

/**
 * Whitelist of allowed commands that can be executed
 * Only predefined commands are allowed to prevent arbitrary shell command execution
 */
const ALLOWED_COMMANDS: string[] = [
  'openclaw backup',
  'openclaw restore',
  'stock-update',
  'healthcheck',
  'openclaw gateway restart',
  'openclaw status',
  'system-update',
  'cleanup-logs',
];

/**
 * Validate if a command is in the allowed whitelist
 */
function isCommandAllowed(command: string): boolean {
  // Trim whitespace and check if the command starts with any allowed prefix
  // This allows for additional arguments after the base command
  const trimmedCommand = command.trim();
  return ALLOWED_COMMANDS.some(allowed => 
    trimmedCommand === allowed || trimmedCommand.startsWith(`${allowed} `)
  );
}

/**
 * Write tasks to jobs.json
 */
function writeTasks(tasks: CronTask[]): void {
  const jobsPath = getJobsJsonPath();
  const dir = path.dirname(jobsPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(jobsPath, JSON.stringify(tasks, null, 2));
}

/**
 * Express router for tasks API
 */
export const router = express.Router();

/**
 * @api {get} /api/tasks Get all cron tasks
 * @apiName GetAllTasks
 * @apiGroup Tasks
 * @apiDescription Get all configured cron tasks with next execution time
 * @apiSuccess {Object[]} tasks List of tasks
 * @apiSuccess {String} tasks.id Task unique identifier
 * @apiSuccess {String} tasks.name Task name
 * @apiSuccess {String} tasks.cron Cron expression
 * @apiSuccess {String} tasks.command Command to execute
 * @apiSuccess {Boolean} tasks.enabled Whether the task is enabled
 * @apiSuccess {String} [tasks.description] Optional description
 * @apiSuccess {String} tasks.createdAt Creation timestamp
 * @apiSuccess {String} tasks.updatedAt Last update timestamp
 * @apiSuccess {String|null} tasks.nextRun Next execution time ISO string or null if invalid
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/tasks
 */
router.get('/', (req, res) => {
  try {
    const tasks = readTasks();
    const tasksWithNextRun = tasks.map(task => ({
      ...task,
      nextRun: task.enabled ? getNextRunTime(task.cron) : null,
    }));

    const response: TasksResponse = {
      tasks: tasksWithNextRun,
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ 
      error: 'Failed to read tasks', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @api {get} /api/tasks/history Get all execution history
 * @apiName GetAllHistory
 * @apiGroup Tasks
 * @apiDescription Get all execution history across all tasks
 * @apiSuccess {Object[]} history List of all execution records
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/tasks/history
 */
router.get('/history', (req, res) => {
  try {
    const history = readExecutionHistory();
    const sortedHistory = history
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    res.json({ history: sortedHistory });
  } catch (error) {
    console.error('Error getting execution history:', error);
    res.status(500).json({ 
      error: 'Failed to read task history', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @api {get} /api/tasks/:id Get a specific cron task
 * @apiName GetTaskById
 * @apiGroup Tasks
 * @apiDescription Get a specific cron task by ID
 * @apiParam {String} id Task ID
 * @apiSuccess {Object} task Task details
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/tasks/123
 */
router.get('/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    const tasks = readTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found', message: `Task with id ${taskId} not found` });
    }
    
    res.json({ task });
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({ 
      error: 'Failed to read task', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @api {post} /api/tasks Create a new cron task
 * @apiName CreateTask
 * @apiGroup Tasks
 * @apiDescription Create a new cron task
 * @apiBody {String} name Task name
 * @apiBody {String} cron Cron expression
 * @apiBody {String} command Command to execute (must be in allowed whitelist)
 * @apiBody {Boolean} enabled Whether the task is enabled
 * @apiBody {String} [description] Optional description
 * @apiSuccess {Object} task Created task details
 * @apiExample {curl} Example usage:
 *   curl -X POST -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
 *     http://localhost:3000/api/tasks \
 *     -d '{"name": "Daily Backup", "cron": "0 0 * * *", "command": "openclaw backup", "enabled": true}'
 */
router.post('/', (req, res) => {
  try {
    const { name, cron, command, enabled, description } = req.body;
    
    // Validate required fields
    if (!name || !cron || !command) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        message: 'name, cron, and command are required'
      });
    }
    
    // Validate command against whitelist
    if (!isCommandAllowed(command)) {
      return res.status(400).json({ 
        error: 'Command not allowed', 
        message: 'Only predefined commands are allowed. Allowed commands: ' + ALLOWED_COMMANDS.join(', ')
      });
    }
    
    // Validate cron expression
    try {
      CronExpressionParser.parse(cron);
    } catch {
      return res.status(400).json({ 
        error: 'Invalid cron expression', 
        message: 'The provided cron expression is invalid'
      });
    }
    
    const tasks = readTasks();
    
    // Create new task
    const newTask: CronTask = {
      id: Date.now().toString(),
      name: name.trim(),
      cron: cron.trim(),
      command: command.trim(),
      enabled: Boolean(enabled),
      description: description ? description.trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    tasks.push(newTask);
    writeTasks(tasks);
    
    res.status(201).json({ task: newTask });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ 
      error: 'Failed to create task', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @api {put} /api/tasks/:id Update an existing cron task
 * @apiName UpdateTask
 * @apiGroup Tasks
 * @apiDescription Update an existing cron task
 * @apiParam {String} id Task ID
 * @apiBody {String} [name] Task name
 * @apiBody {String} [cron] Cron expression
 * @apiBody {String} [command] Command to execute (must be in allowed whitelist)
 * @apiBody {Boolean} [enabled] Whether the task is enabled
 * @apiBody {String} [description] Optional description
 * @apiSuccess {Object} task Updated task details
 * @apiExample {curl} Example usage:
 *   curl -X PUT -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
 *     http://localhost:3000/api/tasks/123 \
 *     -d '{"enabled": false}'
 */
router.put('/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    const updates = req.body;
    
    const tasks = readTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found', message: `Task with id ${taskId} not found` });
    }
    
    const existingTask = tasks[taskIndex];
    
    // If command is being updated, validate it against whitelist
    if (updates.command !== undefined && !isCommandAllowed(updates.command)) {
      return res.status(400).json({ 
        error: 'Command not allowed', 
        message: 'Only predefined commands are allowed. Allowed commands: ' + ALLOWED_COMMANDS.join(', ')
      });
    }
    
    // If cron is being updated, validate it
    if (updates.cron !== undefined) {
      try {
        CronExpressionParser.parse(updates.cron);
      } catch {
        return res.status(400).json({ 
          error: 'Invalid cron expression', 
          message: 'The provided cron expression is invalid'
        });
      }
    }
    
    // Update task
    const updatedTask: CronTask = {
      ...existingTask,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    tasks[taskIndex] = updatedTask;
    writeTasks(tasks);
    
    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ 
      error: 'Failed to update task', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @api {delete} /api/tasks/:id Delete a cron task
 * @apiName DeleteTask
 * @apiGroup Tasks
 * @apiDescription Delete a cron task
 * @apiParam {String} id Task ID
 * @apiSuccess {String} message Success message
 * @apiExample {curl} Example usage:
 *   curl -X DELETE -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/tasks/123
 */
router.delete('/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    const tasks = readTasks();
    const filteredTasks = tasks.filter(t => t.id !== taskId);
    
    if (filteredTasks.length === tasks.length) {
      return res.status(404).json({ error: 'Task not found', message: `Task with id ${taskId} not found` });
    }
    
    writeTasks(filteredTasks);
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ 
      error: 'Failed to delete task', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @api {get} /api/tasks/:id/history Get execution history for a task
 * @apiName GetTaskHistory
 * @apiGroup Tasks
 * @apiDescription Get execution history for a specific task
 * @apiParam {String} id Task ID
 * @apiSuccess {Object[]} history List of execution records
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/tasks/123/history
 */
router.get('/:id/history', (req, res) => {
  try {
    const taskId = req.params.id;
    const history = readExecutionHistory();
    const taskHistory = history.filter(h => h.taskId === taskId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    res.json({ history: taskHistory });
  } catch (error) {
    console.error('Error getting task history:', error);
    res.status(500).json({ 
      error: 'Failed to read task history', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
