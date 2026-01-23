import { homedir } from 'os';
import { join, normalize } from 'path';

/**
 * Expands ~ to home directory and normalizes path separators for current platform.
 * @param pathSegment - Path string that may start with ~
 * @returns Absolute path with platform-specific separators
 */
function resolveHome(pathSegment: string): string {
  if (pathSegment.startsWith('~/') || pathSegment.startsWith('~\\')) {
    return normalize(join(homedir(), pathSegment.slice(2)));
  }
  if (pathSegment === '~') {
    return homedir();
  }
  return normalize(pathSegment);
}

/**
 * Returns absolute path to GSDO base cache directory.
 * Location: ~/.gsdo/cache/
 * @returns Absolute path to base cache directory
 */
export function getGsdoCachePath(): string {
  return resolveHome('~/.gsdo/cache');
}

/**
 * Returns absolute path to OpenCode documentation cache directory.
 * Location: ~/.gsdo/cache/docs-opencode/
 * @returns Absolute path to OpenCode docs cache directory
 */
export function getDocsOpenCodeCachePath(): string {
  return join(getGsdoCachePath(), 'docs-opencode');
}

/**
 * Returns absolute path to documentation URLs file.
 * Location: ~/.gsdo/docs-urls.json
 * Contains URLs for Claude Code and OpenCode documentation that /gsdo uses for reference.
 * @returns Absolute path to docs-urls.json file
 */
export function getDocsUrlsPath(): string {
  return join(resolveHome('~/.gsdo'), 'docs-urls.json');
}

/**
 * Returns absolute path to downloaded documentation cache.
 * Location: ~/.gsdo/cache/docs/
 * Contains cached copies of Claude Code and OpenCode documentation.
 * @returns Absolute path to docs cache directory
 */
export function getDocsCachePath(): string {
  return join(getGsdoCachePath(), 'docs');
}
