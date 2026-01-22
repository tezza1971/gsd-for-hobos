import { homedir } from 'os';
import { join, normalize } from 'path';

/**
 * Expands ~ to home directory and normalizes path separators for current platform.
 * @param pathSegment - Path string that may start with ~
 * @returns Absolute path with platform-specific separators
 */
export function resolveHome(pathSegment: string): string {
  if (pathSegment.startsWith('~/') || pathSegment.startsWith('~\\')) {
    return normalize(join(homedir(), pathSegment.slice(2)));
  }
  if (pathSegment === '~') {
    return homedir();
  }
  return normalize(pathSegment);
}

/**
 * Returns absolute path to GSD installation directory.
 * Standard location: ~/.claude/get-shit-done/
 * @returns Absolute path to GSD installation
 */
export function getGsdPath(): string {
  return resolveHome('~/.claude/get-shit-done');
}

/**
 * Returns first existing OpenCode config directory from platform-specific priority list.
 * Priority order:
 * 1. .opencode/ (project-local)
 * 2. ~/.config/opencode/ (Linux/macOS)
 * 3. %APPDATA%/opencode/ (Windows)
 * 4. ~/Library/Application Support/opencode/ (macOS)
 *
 * @returns Path to first existing OpenCode directory, or default (~/.config/opencode/)
 */
export function getOpenCodePath(): string {
  const candidates: string[] = [
    '.opencode',
    resolveHome('~/.config/opencode')
  ];

  // Add platform-specific paths
  if (process.platform === 'win32') {
    // Windows: %APPDATA%/opencode/
    const appData = process.env.APPDATA;
    if (appData) {
      candidates.push(normalize(join(appData, 'opencode')));
    }
  } else if (process.platform === 'darwin') {
    // macOS: ~/Library/Application Support/opencode/
    candidates.push(resolveHome('~/Library/Application Support/opencode'));
  }

  // Return first candidate (detector will check existence)
  return candidates[0];
}

/**
 * Returns all candidate paths for OpenCode config directory in priority order.
 * Used by detector to check multiple locations.
 * @returns Array of absolute paths to check
 */
export function getOpenCodeCandidates(): string[] {
  const candidates: string[] = [
    '.opencode',
    resolveHome('~/.config/opencode')
  ];

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      candidates.push(normalize(join(appData, 'opencode')));
    }
  } else if (process.platform === 'darwin') {
    candidates.push(resolveHome('~/Library/Application Support/opencode'));
  }

  return candidates;
}
