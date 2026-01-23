import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getGsdPath, getOpenCodeCandidates, resolveHome } from './paths.js';
import { formatError, ErrorCategory } from './ui/error-formatter.js';

export interface DetectionResult {
  found: boolean;
  path?: string;
  error?: string;
}

export interface OpenCodeDetectionResult extends DetectionResult {
  created?: boolean;
}

/**
 * Detects GSD installation by checking standard location.
 * Validates that the workflows/ subdirectory exists (where /gsd:* commands live).
 *
 * @returns Detection result with path or error
 */
export function detectGsd(): DetectionResult {
  const gsdPath = getGsdPath();

  if (!existsSync(gsdPath)) {
    const formatted = formatError(ErrorCategory.GSD_NOT_FOUND, {
      checkedPath: gsdPath
    });
    return {
      found: false,
      error: `${formatted.message}
${formatted.resolution}
See troubleshooting: ${formatted.troubleshootingUrl || ''}`
    };
  }

  // Validate workflows/ subdirectory exists
  const skillsPath = join(gsdPath, 'workflows');
  if (!existsSync(skillsPath)) {
    const formatted = formatError(ErrorCategory.GSD_NOT_FOUND, {
      checkedPath: skillsPath,
      details: 'workflows/ directory not found'
    });
    return {
      found: false,
      error: `GSD installation incomplete: workflows/ directory not found at ${skillsPath}
${formatted.resolution}
See troubleshooting: ${formatted.troubleshootingUrl || ''}`
    };
  }

  return {
    found: true,
    path: gsdPath
  };
}

/**
 * Detects OpenCode config directory by checking multiple candidate locations.
 * If none exist, creates the default directory (~/.config/opencode/).
 *
 * Priority order:
 * 1. .opencode/ (project-local)
 * 2. ~/.config/opencode/ (Linux/macOS default)
 * 3. %APPDATA%/opencode/ (Windows)
 * 4. ~/Library/Application Support/opencode/ (macOS)
 *
 * @returns Detection result with path, creation status, or error
 */
export function detectOpenCode(): OpenCodeDetectionResult {
  const candidates = getOpenCodeCandidates();

  // Check each candidate in priority order
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return {
        found: true,
        path: candidate,
        created: false
      };
    }
  }

  // None exist - create default directory
  const defaultPath = resolveHome('~/.config/opencode');

  try {
    mkdirSync(defaultPath, { recursive: true });
    return {
      found: true,
      path: defaultPath,
      created: true
    };
  } catch (error) {
    const formatted = formatError(ErrorCategory.OPENCODE_NOT_ACCESSIBLE, {
      path: defaultPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      found: false,
      error: `${formatted.message}
${formatted.resolution}
See troubleshooting: ${formatted.troubleshootingUrl || ''}`
    };
  }
}
