/**
 * @fileoverview OpenClaw Web Console - Skills API
 * Provides REST API for getting list of installed skills
 * 
 * @author OpenClaw Team
 * @license MIT
 */
import fs from 'fs';
import path from 'path';
import express from 'express';

/** Express router for skills API */
const router = express.Router();

/** Path to OpenClaw configuration file */
const OPENCLAW_CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.openclaw',
  'openclaw.json'
);

/** Path to OpenClaw skills directory */
const OPENCLAW_SKILLS_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.openclaw',
  'workspace',
  'skills'
);

/**
 * Skill information interface
 */
export interface SkillInfo {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  version?: string;
}

/**
 * OpenClaw configuration interface
 */
interface OpenClawConfig {
  skills: {
    entries: Record<string, { enabled: boolean; [key: string]: unknown }>;
  };
}

/**
 * Read skill description from SKILL.md if available
 */
function readSkillDescription(skillDir: string): string | undefined {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (fs.existsSync(skillMdPath)) {
    try {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      // Extract first paragraph as description
      const firstLine = content.split('\n')[0];
      if (firstLine && firstLine.startsWith('# ')) {
        // Get next paragraph after title
        const paragraphs = content.split('\n\n');
        return paragraphs[1]?.trim().slice(0, 100) || undefined;
      }
      return content.trim().slice(0, 100) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * @api {get} /api/skills Get all installed skills
 * @apiName GetSkills
 * @apiGroup Skills
 * @apiDescription Get list of all installed skills with their enabled status
 * @apiSuccess {SkillInfo[]} skills List of skills
 * @apiExample {curl} Example usage:
 *   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/skills
 */
router.get('/', (req, res) => {
  try {
    const skills: SkillInfo[] = [];

    // Read from configuration first for enabled status
    if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      const configContent = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
      const config: OpenClawConfig = JSON.parse(configContent);
      
      if (config.skills?.entries) {
        for (const [id, entry] of Object.entries(config.skills.entries)) {
          skills.push({
            id,
            name: id,
            enabled: entry.enabled,
            description: readSkillDescription(path.join(OPENCLAW_SKILLS_DIR, id)),
          });
        }
      }
    }

    // Also scan skills directory for any skills not in config
    if (fs.existsSync(OPENCLAW_SKILLS_DIR)) {
      const skillDirs = fs.readdirSync(OPENCLAW_SKILLS_DIR);
      for (const dir of skillDirs) {
        const fullPath = path.join(OPENCLAW_SKILLS_DIR, dir);
        if (fs.statSync(fullPath).isDirectory() && !skills.some(s => s.id === dir)) {
          skills.push({
            id: dir,
            name: dir,
            enabled: false,
            description: readSkillDescription(fullPath),
          });
        }
      }
    }

    // Sort by enabled status and then id
    skills.sort((a, b) => {
      if (a.enabled !== b.enabled) {
        return b.enabled ? 1 : -1;
      }
      return a.id.localeCompare(b.id);
    });

    res.json({
      skills,
      total: skills.length,
      enabledCount: skills.filter(s => s.enabled).length,
    });
  } catch (error) {
    console.error('Failed to read skills configuration:', error);
    res.status(500).json({
      error: 'ConfigReadError',
      message: error instanceof Error ? error.message : 'Unknown error reading configuration'
    });
  }
});

export { router };
export default router;
