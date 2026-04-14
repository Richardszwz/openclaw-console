/**
 * @fileoverview Task Editor - cron editor with natural language support
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import { useState, useEffect } from 'react';
import './TaskEditor.css';

/**
 * Common natural language to cron mapping
 */
const commonPatterns: Record<string, string> = {
  '每天凌晨3点': '0 3 * * *',
  '每天凌晨三点': '0 3 * * *',
  '每天早上8点': '0 8 * * *',
  '每天中午12点': '0 12 * * *',
  '每天下午6点': '0 18 * * *',
  '每天午夜': '0 0 * * *',
  '每小时一次': '0 * * * *',
  '每小时整点': '0 * * * *',
  '每半小时一次': '*/30 * * * *',
  '每15分钟一次': '*/15 * * * *',
  '每天': '0 0 * * *',
  '每周一': '0 0 * * 1',
  '每周一早上': '0 9 * * 1',
  '每周五': '0 0 * * 5',
  '每周日': '0 0 * * 0',
  '每个周一': '0 0 * * 1',
  '每个月第一天': '0 0 1 * *',
  '每月一号': '0 0 1 * *',
  '每天凌晨': '0 0 * * *',
  '每两个小时': '0 */2 * * *',
  '每两小时': '0 */2 * * *',
  '每两个小时一次': '0 */2 * * *',
  '每天早上9点': '0 9 * * *',
  '每天晚上10点': '0 22 * * *',
  '每周': '0 0 * * 0',
  '每个月': '0 0 1 * *',
  '每分钟': '* * * * *',
  '每五分钟': '*/5 * * * *',
  '工作日': '0 9 * * 1-5',
  '工作日每天9点': '0 9 * * 1-5',
  '周末': '0 10 * * 0,6',
  '周末每天10点': '0 10 * * 0,6',
};

/**
 * Quick suggestion buttons
 */
const quickSuggestions = [
  { label: '每天凌晨3点', cron: '0 3 * * *' },
  { label: '每小时一次', cron: '0 * * * *' },
  { label: '每30分钟', cron: '*/30 * * * *' },
  { label: '每天早上8点', cron: '0 8 * * *' },
  { label: '每周一早上9点', cron: '0 9 * * 1' },
  { label: '每月一号', cron: '0 0 1 * *' },
  { label: '工作日9点', cron: '0 9 * * 1-5' },
  { label: '每分钟', cron: '* * * * *' },
];

/**
 * Parse natural language to cron expression
 */
const parseNaturalLanguage = (input: string): { success: boolean; cron: string; message: string } => {
  const trimmedInput = input.trim().toLowerCase();

  // Check exact matches first
  for (const [pattern, cron] of Object.entries(commonPatterns)) {
    if (trimmedInput.includes(pattern.toLowerCase())) {
    return { success: true, cron, message: `转换成功` };
    }
  }

  // Pattern matching
  // Every X minutes/hours/hours
  const everyMatch = trimmedInput.match(/每\s*(\d+)\s*(分钟|小时|天)/);
  if (everyMatch) {
    const num = parseInt(everyMatch[1]);
    const unit = everyMatch[2];
    if (unit === '分钟') {
      return { success: true, cron: `*/${num} * * * *`, message: `每${num}分钟执行一次` };
    }
    if (unit === '小时') {
      return { success: true, cron: `0 */${num} * * *`, message: `每${num}小时执行一次` };
    }
    if (unit === '天') {
      return { success: true, cron: `0 0 */${num} * *`, message: `每${num}天执行一次` };
    }
  }

  // At X o'clock every day
  const timeMatch = trimmedInput.match(/(每天|每日).*?(\d+)\s*(点|点钟)/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[2]);
    return { success: true, cron: `0 ${hour} * * *`, message: `每天 ${hour} 点执行` };
  }

  // At X:Y every day
  const timeMinuteMatch = trimmedInput.match(/(每天|每日).*?(\d+):(\d+)/);
  if (timeMinuteMatch) {
    const hour = parseInt(timeMinuteMatch[2]);
    const minute = parseInt(timeMinuteMatch[3]);
    return { success: true, cron: `${minute} ${hour} * * *`, message: `每天 ${hour}:${minute} 执行` };
  }

  // Every weekday
  const weekdayMatch = trimmedInput.match(/(每周|每星期)\s*(周|星期|周一|周二|周三|周四|周五|周六|周日|星期一|星期二|星期三|星期四|星期五|星期六|星期日)/);
  if (weekdayMatch) {
    const dayName = weekdayMatch[2];
    const dayMap: Record<string, number> = {
      '日': 0, '周日': 0, '星期日': 0,
      '一': 1, '周一': 1, '星期一': 1,
      '二': 2, '周二': 2, '星期二': 2,
      '三': 3, '周三': 3, '星期三': 3,
      '四': 4, '周四': 4, '星期四': 4,
      '五': 5, '周五': 5, '星期五': 5,
      '六': 6, '周六': 6, '星期六': 6,
    };
    const day = dayMap[dayName] ?? 0;
    return { success: true, cron: `0 0 * * ${day}`, message: `每周${dayName}执行` };
  }

  // Could not parse
  return { success: false, cron: '', message: '无法解析，请手动输入 cron 表达式' };
};

/**
 * Validate cron expression using simple rules
 */
const validateCron = (cron: string): { valid: boolean; message: string } => {
  const trimmed = cron.trim();
  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);

  // Standard cron has 5 parts
  if (parts.length !== 5) {
    return {
      valid: false,
      message: `Cron 表达式需要 5 个部分（分 时 日 月 周），当前有 ${parts.length} 个部分`,
    };
  }

  // Basic validation for each field
  const ranges = [
    [0, 59], // minutes
    [0, 23], // hours
    [1, 31], // day
    [1, 12], // month
    [0, 6], // weekday (0-6 for Sunday-Saturday)
  ];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const [min, max] = ranges[i];

    // Check special characters
    if (!/^[*/0-9,-]+$/.test(part)) {
      return {
        valid: false,
        message: `第 ${i+1} 个部分包含无效字符，仅允许数字、* / , -`,
      };
    }

    // Check individual numbers
    part.split(/[,-]/).forEach(p => {
      p = p.includes('/') ? p.split('/')[1] : p;
      if (p !== '*' && !isNaN(parseInt(p))) {
        const num = parseInt(p);
        if (num < min || num > max) {
          return {
            valid: false,
            message: `第 ${i+1} 个部分数值 ${num} 超出范围 [${min}, ${max}]`,
          };
        }
      }
    });
  }

  return { valid: true, message: 'Cron 表达式格式正确' };
};

/**
 * Get next run times for preview (reserved for future use)
 */
// const getNextRuns = (cron: string, count: number = 3): Date[] => {
//   try {
//     // Simple parsing for preview
//     const result: Date[] = [];
//     const now = new Date();
//     // In real implementation we'd use cron-parser, but for frontend
//     // we do basic estimation for preview
//     // For full implementation would require cron-parser on backend
//     return [];
//   } catch (e) {
//     return [];
//   }
// };

interface TaskEditorProps {
  onBack: () => void;
  onSave?: () => void;
}

/**
 * Task Editor component
 */
function TaskEditor({ onBack, onSave }: TaskEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [command, setCommand] = useState('');
  const [cron, setCron] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [naturalInput, setNaturalInput] = useState('');
  const [conversionResult, setConversionResult] = useState<{
    success: boolean;
    cron: string;
    message: string;
  } | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; message: string } | null>(null);

  /**
   * Validate cron when it changes
   */
  useEffect(() => {
    if (cron.trim().length > 0) {
      setValidation(validateCron(cron));
    } else {
      setValidation(null);
    }
  }, [cron]);

  /**
   * Handle natural language conversion
   */
  const handleConvert = () => {
    if (!naturalInput.trim()) {
      setConversionResult(null);
      return;
    }
    const result = parseNaturalLanguage(naturalInput);
    setConversionResult(result);
    if (result.success) {
      setCron(result.cron);
    }
  };

  /**
   * Handle suggestion click
   */
  const handleSuggestion = (suggestion: { label: string; cron: string }) => {
    setNaturalInput(suggestion.label);
    setConversionResult({ success: true, cron: suggestion.cron, message: suggestion.label });
    setCron(suggestion.cron);
  };

  /**
   * Handle save
   */
  const handleSave = () => {
    // TODO: Implement save to backend
    console.log('Save task', { name, description, command, cron, enabled });
    if (onSave) {
      onSave();
    }
    onBack();
  };

  return (
    <div className="task-editor-container">
      <div className="editor-header">
        <h1>添加定时任务</h1>
        <button className="back-btn" onClick={onBack}>
          返回
        </button>
      </div>

      <div className="natural-language-section">
        <h3>自然语言输入</h3>
        <div className="natural-input">
          <label>输入自然语言描述</label>
          <input
            type="text"
            placeholder='例如: "每天凌晨3点" "每小时一次" "每周一早上9点"'
            value={naturalInput}
            onChange={(e) => setNaturalInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
          />
        </div>
        <button className="convert-btn" onClick={handleConvert} disabled={!naturalInput.trim()}>
          转换为 Cron 表达式
        </button>

        {conversionResult && (
          <div className={`conversion-result ${conversionResult.success ? 'success' : 'error'}`}>
            {conversionResult.message}
            {conversionResult.success && (
              <div>转换结果: <code className="cron-expression">{conversionResult.cron}</code></div>
            )}
          </div>
        )}

        <div className="suggestions">
          <h4>常用示例</h4>
          <div className="suggestion-tags">
            {quickSuggestions.map((sug) => (
              <span
                key={sug.cron}
                className="suggestion-tag"
                onClick={() => handleSuggestion(sug)}
              >
                {sug.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>任务名称</label>
        <input
          type="text"
          placeholder="给任务起个名字"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>描述（可选）</label>
        <textarea
          placeholder="任务用途描述"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Cron 表达式</label>
        <input
          type="text"
          placeholder="例如: 0 3 * * *"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
        />
        {validation && (
          <div className={`cron-validation ${validation.valid ? 'valid' : 'invalid'}`}>
            {validation.message}
          </div>
        )}
        {cron && validation?.valid && (
          <div className="next-run-preview">
            <div className="next-run-label">下次执行</div>
            <div className="next-run-value">
              将在服务端解析后显示
            </div>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>执行命令</label>
        <textarea
          placeholder="要执行的命令，例如: openclaw backup"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
        />
      </div>

      <div className="form-group">
        <div className="enabled-checkbox">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <label htmlFor="enabled">启用任务</label>
        </div>
      </div>

      <div className="form-actions">
        <button className="cancel-btn" onClick={onBack}>
          取消
        </button>
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={!name || !cron || !validation?.valid === false}
        >
          保存任务
        </button>
      </div>
    </div>
  );
}

export default TaskEditor;
