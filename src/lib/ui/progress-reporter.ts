/**
 * Progress reporter with timing and verbosity-aware output
 */

import pc from 'picocolors';
import { VerbosityLevel, type ProgressStep, type InstallationStats } from './types.js';

/**
 * Check if terminal supports colors
 */
function supportsColor(): boolean {
  return process.stdout.isTTY !== false && !process.env.NO_COLOR;
}

/**
 * Progress reporter that tracks timing and formats output based on verbosity
 */
export class ProgressReporter {
  private verbosity: VerbosityLevel;
  private steps: ProgressStep[] = [];
  private currentStep: ProgressStep | null = null;
  private hasColor: boolean;

  constructor(verbosity: VerbosityLevel) {
    this.verbosity = verbosity;
    this.hasColor = supportsColor();
  }

  /**
   * Start a new progress step
   */
  startStep(name: string): void {
    // End previous step if still running
    if (this.currentStep && !this.currentStep.endTime) {
      this.endStep();
    }

    const step: ProgressStep = {
      name,
      startTime: Date.now(),
    };

    this.currentStep = step;
    this.steps.push(step);

    // Log based on verbosity
    if (this.verbosity === VerbosityLevel.VERBOSE) {
      console.log(`→ ${name}...`);
    } else if (this.verbosity === VerbosityLevel.NORMAL) {
      console.log(`→ ${name}...`);
    }
    // QUIET mode: skip
  }

  /**
   * End the current step and log completion with timing
   */
  endStep(): void {
    if (!this.currentStep) return;

    this.currentStep.endTime = Date.now();
    const duration = ((this.currentStep.endTime - this.currentStep.startTime) / 1000).toFixed(1);

    // Log completion based on verbosity
    if (this.verbosity === VerbosityLevel.VERBOSE || this.verbosity === VerbosityLevel.NORMAL) {
      const green = this.hasColor ? pc.green : (s: string) => s;
      const dim = this.hasColor ? pc.dim : (s: string) => s;
      console.log(`  ${green('✓')} ${this.currentStep.name} ${dim(`(${duration}s)`)}`);
    }
    // QUIET mode: skip

    this.currentStep = null;
  }

  /**
   * Log a message respecting verbosity level
   *
   * @param message - Message to log
   * @param level - Log level (info, success, warning, error)
   */
  log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    // Errors always show, regardless of verbosity
    if (level === 'error') {
      const red = this.hasColor ? pc.red : (s: string) => s;
      console.log(`  ${red('✗')} ${message}`);
      return;
    }

    // QUIET mode: skip non-errors
    if (this.verbosity === VerbosityLevel.QUIET) {
      return;
    }

    // Apply colors based on level
    let prefix = '  ';
    let coloredMessage = message;

    if (this.hasColor) {
      switch (level) {
        case 'success':
          prefix = `  ${pc.green('✓')} `;
          break;
        case 'warning':
          prefix = `  ${pc.yellow('⚠')} `;
          break;
        case 'info':
        default:
          prefix = '  ';
          break;
      }
    } else {
      // No color fallback
      switch (level) {
        case 'success':
          prefix = '  ✓ ';
          break;
        case 'warning':
          prefix = '  ⚠ ';
          break;
        case 'info':
        default:
          prefix = '  ';
          break;
      }
    }

    console.log(prefix + coloredMessage);
  }

  /**
   * Get final installation statistics
   */
  getFinalStats(): InstallationStats {
    // Calculate total time from first to last step
    if (this.steps.length === 0) {
      return { totalTime: 0, steps: [] };
    }

    const firstStep = this.steps[0];
    const lastStep = this.steps[this.steps.length - 1];
    const totalTime = lastStep.endTime
      ? (lastStep.endTime - firstStep.startTime) / 1000
      : 0;

    return {
      totalTime,
      steps: this.steps,
    };
  }
}
