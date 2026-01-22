import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getGsdPath, getOpenCodeCandidates, resolveHome } from './paths.js';

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
 * Validates that the skills/ subdirectory exists (where /gsd:* commands live).
 *
 * @returns Detection result with path or error
 */
export function detectGsd(): DetectionResult {
  const gsdPath = getGsdPath();

  if (!existsSync(gsdPath)) {
    return {
      found: false,
      error: `GSD not found at ${gsdPath}`
    };
  }

  // Validate skills/ subdirectory exists
  const skillsPath = join(gsdPath, 'skills');
  if (!existsSync(skillsPath)) {
    return {
      found: false,
      error: `GSD installation incomplete: skills/ directory not found at ${skillsPath}`
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
    return {
      found: false,
      error: `Cannot create OpenCode directory at ${defaultPath}: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
