/**
 * Error Formatter
 *
 * Produces specific, actionable error messages with troubleshooting links.
 * Makes errors helpful rather than frustrating.
 */

export enum ErrorCategory {
  GSD_NOT_FOUND = 'gsd_not_found',
  OPENCODE_NOT_FOUND = 'opencode_not_found',
  OPENCODE_NOT_ACCESSIBLE = 'opencode_not_accessible',
  CACHE_FAILURE = 'cache_failure',
  TRANSPILATION_FAILURE = 'transpilation_failure',
  ENHANCEMENT_FAILURE = 'enhancement_failure',
  LOG_WRITE_FAILURE = 'log_write_failure',
}

export interface FormattedError {
  message: string;
  details?: string;
  resolution: string;
  troubleshootingUrl?: string;
}

const TROUBLESHOOTING_BASE = 'https://github.com/tezza1971/gsd-open/docs/troubleshooting.md';

/**
 * Formats an error with specific, actionable messaging based on category.
 *
 * @param category - Error category for specific handling
 * @param context - Additional context (paths, error messages, command names)
 * @returns Formatted error with message, resolution, and troubleshooting link
 */
export function formatError(
  category: ErrorCategory,
  context?: Record<string, any>
): FormattedError {
  switch (category) {
    case ErrorCategory.GSD_NOT_FOUND: {
      const checkedPath = context?.checkedPath || '~/.claude/get-shit-done/';
      const message = `GSD not found at ${checkedPath}`;
      const details = context?.checkedPaths
        ? `Checked paths: ${context.checkedPaths.join(', ')}`
        : undefined;
      const resolution = 'Install GSD first: https://github.com/glittercowboy/get-shit-done';
      const troubleshootingUrl = `${TROUBLESHOOTING_BASE}#gsd-not-found`;

      return { message, details, resolution, troubleshootingUrl };
    }

    case ErrorCategory.OPENCODE_NOT_FOUND: {
      const message = 'OpenCode config directory not found';
      const details = 'Checked: .opencode/, ~/.config/opencode/, %APPDATA%/opencode/';
      const resolution = 'Install OpenCode first or create config directory manually';
      const troubleshootingUrl = `${TROUBLESHOOTING_BASE}#opencode-not-found`;

      return { message, details, resolution, troubleshootingUrl };
    }

    case ErrorCategory.OPENCODE_NOT_ACCESSIBLE: {
      const path = context?.path || 'OpenCode config directory';
      const permError = context?.error || 'Permission denied';
      const message = 'Cannot write to OpenCode config directory';
      const details = `Path: ${path}\nError: ${permError}`;
      const resolution = `Check file permissions on ${path}`;
      const troubleshootingUrl = `${TROUBLESHOOTING_BASE}#permission-denied`;

      return { message, details, resolution, troubleshootingUrl };
    }

    case ErrorCategory.CACHE_FAILURE: {
      const error = context?.error || 'Unknown error';
      const message = 'Failed to cache OpenCode documentation';
      const details = `Error: ${error}`;
      const resolution = 'Check network connection or disk space. Installer will continue without cached docs.';
      const troubleshootingUrl = `${TROUBLESHOOTING_BASE}#cache-failure`;

      return { message, details, resolution, troubleshootingUrl };
    }

    case ErrorCategory.TRANSPILATION_FAILURE: {
      const commandName = context?.commandName || 'command';
      const error = context?.error || 'Unknown error';
      const filePath = context?.filePath;
      const message = `Failed to transpile ${commandName}`;
      const details = filePath
        ? `File: ${filePath}\nError: ${error}`
        : `Error: ${error}`;
      const resolution = filePath
        ? `Check command file at ${filePath} for syntax errors. See install log for details.`
        : 'See install log at ~/.gsdo/install.md for details.';
      const troubleshootingUrl = `${TROUBLESHOOTING_BASE}#transpilation-errors`;

      return { message, details, resolution, troubleshootingUrl };
    }

    case ErrorCategory.ENHANCEMENT_FAILURE: {
      const error = context?.error || 'Unknown error';
      const message = 'Failed to enhance commands with /gsdo';
      const details = `Error: ${error}`;
      const resolution = 'Commands installed but not enhanced. Run /gsdo in OpenCode manually.';
      const troubleshootingUrl = `${TROUBLESHOOTING_BASE}#enhancement-errors`;

      return { message, details, resolution, troubleshootingUrl };
    }

    case ErrorCategory.LOG_WRITE_FAILURE: {
      const error = context?.error || 'Unknown error';
      const message = 'Failed to write log to ~/.gsdo/';
      const details = `Error: ${error}`;
      const resolution = 'Check disk space and permissions. Installation succeeded despite logging failure.';
      const troubleshootingUrl = `${TROUBLESHOOTING_BASE}#log-errors`;

      return { message, details, resolution, troubleshootingUrl };
    }

    default:
      return {
        message: 'Unknown error occurred',
        resolution: 'Check logs for details or report issue on GitHub',
        troubleshootingUrl: TROUBLESHOOTING_BASE,
      };
  }
}
