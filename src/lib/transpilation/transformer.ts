/**
 * GSD to OpenCode Transformer
 *
 * Transforms GSD Intermediate Representation into OpenCode configuration
 * using config-driven mapping rules. Supports user overrides via ~/.gsdo/transforms.json.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  GSDIntermediate,
  GSDAgent,
  GSDCommand,
  GSDModel,
  GSDConfig,
} from './ir-types.js';
import type {
  TransformResult,
  OpenCodeConfig,
  TransformGaps,
  GapCategory,
} from '../../types/index.js';
import defaultRules from './transform-rules.json' with { type: 'json' };

/**
 * Transform rules structure for GSD to OpenCode mapping.
 */
interface TransformRules {
  version: string;
  description?: string;
  agents: SectionRules;
  commands: SectionRules;
  models: SectionRules;
  config: SectionRules;
  fallback: {
    category: GapCategory;
    suggestion: string;
  };
}

interface SectionRules {
  fieldMappings: Record<string, string>;
  defaults: Record<string, unknown>;
  approximations: Record<string, string>;
  categories: Record<string, GapCategory>;
  suggestions: Record<string, string>;
}

/**
 * Load transform rules with user override support.
 * User rules at ~/.gsdo/transforms.json take precedence over defaults.
 */
async function loadTransformRules(): Promise<TransformRules> {
  const userRulesPath = join(homedir(), '.gsdo', 'transforms.json');

  try {
    const userRulesContent = await readFile(userRulesPath, 'utf-8');
    const userRules = JSON.parse(userRulesContent) as Partial<TransformRules>;

    // Deep merge user rules with defaults (user takes precedence)
    return mergeRules(defaultRules as TransformRules, userRules);
  } catch {
    // No user override, use defaults
    return defaultRules as TransformRules;
  }
}

/**
 * Deep merge transform rules, with override taking precedence.
 */
function mergeRules(base: TransformRules, override: Partial<TransformRules>): TransformRules {
  return {
    version: override.version ?? base.version,
    description: override.description ?? base.description,
    agents: mergeSectionRules(base.agents, override.agents),
    commands: mergeSectionRules(base.commands, override.commands),
    models: mergeSectionRules(base.models, override.models),
    config: mergeSectionRules(base.config, override.config),
    fallback: override.fallback ?? base.fallback,
  };
}

function mergeSectionRules(
  base: SectionRules,
  override?: Partial<SectionRules>
): SectionRules {
  if (!override) return base;

  return {
    fieldMappings: { ...base.fieldMappings, ...override.fieldMappings },
    defaults: { ...base.defaults, ...override.defaults },
    approximations: { ...base.approximations, ...override.approximations },
    categories: { ...base.categories, ...override.categories },
    suggestions: { ...base.suggestions, ...override.suggestions },
  };
}

/**
 * Get category for a field, with fallback to default.
 */
function getCategory(rules: SectionRules, fieldName: string, fallback: GapCategory): GapCategory {
  return rules.categories?.[fieldName] ?? fallback;
}

/**
 * Get suggestion for a field, with fallback to default.
 */
function getSuggestion(rules: SectionRules, fieldName: string, fallback: string): string {
  return rules.suggestions?.[fieldName] ?? fallback;
}

/**
 * Transform GSD Intermediate Representation to OpenCode configuration.
 *
 * @param ir - Parsed GSD intermediate representation
 * @returns Transform result with OpenCode config and gap tracking
 */
export async function transformToOpenCode(ir: GSDIntermediate): Promise<TransformResult> {
  const errors: Array<{ message: string; stack?: string }> = [];
  const warnings: string[] = [];
  const gaps: TransformGaps = {
    unmappedFields: [],
    approximations: [],
  };

  let rules: TransformRules;
  try {
    rules = await loadTransformRules();
  } catch (error) {
    return {
      success: false,
      errors: [{ message: `Failed to load transform rules: ${error}` }],
      warnings: [],
      gaps,
    };
  }

  // Transform each section
  const agents = transformAgents(ir.agents, rules.agents, rules.fallback, gaps, errors, warnings);
  const commands = transformCommands(ir.commands, rules.commands, rules.fallback, gaps, errors, warnings);
  const models = transformModels(ir.models, rules.models, rules.fallback, gaps, errors, warnings);
  const settings = transformConfig(ir.config, rules.config, rules.fallback, gaps, warnings);

  const opencode: OpenCodeConfig = {
    agents,
    commands,
    models,
    settings,
  };

  return {
    success: errors.length === 0,
    opencode,
    errors,
    warnings,
    gaps,
  };
}

/**
 * Transform GSD agents to OpenCode agent configuration.
 */
function transformAgents(
  agents: GSDAgent[],
  rules: SectionRules,
  fallback: TransformRules['fallback'],
  gaps: TransformGaps,
  errors: Array<{ message: string; stack?: string }>,
  warnings: string[]
): OpenCodeConfig['agents'] {
  const sourceFile = 'agents.xml';

  return agents.map((agent) => {
    // Validate required fields
    if (!agent.name) {
      errors.push({ message: `Agent missing required field 'name'` });
    }
    if (!agent.model && !rules.defaults.model) {
      warnings.push(`Agent '${agent.name}' missing 'model' field, no default available`);
    }

    const result: OpenCodeConfig['agents'][number] = {
      name: agent.name,
      model: agent.model ?? (rules.defaults.model as string) ?? '',
      systemMessage: agent.systemPrompt ?? '',
    };

    // Apply field mappings
    if (agent.description !== undefined) {
      result.description = agent.description;
    }
    if (agent.temperature !== undefined) {
      result.temperature = agent.temperature;
    } else if (rules.defaults.temperature !== undefined) {
      result.temperature = rules.defaults.temperature as number;
    }
    if (agent.maxTokens !== undefined) {
      result.maxTokens = agent.maxTokens;
    }

    // Handle approximations
    if (agent.tools && agent.tools.length > 0) {
      result.tools = agent.tools;
      gaps.approximations.push({
        original: `agent.${agent.name}.tools`,
        approximatedAs: 'tools array',
        reason: rules.approximations.tools ?? 'Tools mapped directly',
        sourceFile,
        category: getCategory(rules, 'tools', fallback.category),
      });
    }

    if (agent.config && Object.keys(agent.config).length > 0) {
      result.config = agent.config;
      gaps.approximations.push({
        original: `agent.${agent.name}.config`,
        approximatedAs: 'config object',
        reason: rules.approximations.config ?? 'Config merged into agent',
        sourceFile,
        category: getCategory(rules, 'config', fallback.category),
      });
    }

    return result;
  });
}

/**
 * Transform GSD commands to OpenCode command configuration.
 */
function transformCommands(
  commands: GSDCommand[],
  rules: SectionRules,
  fallback: TransformRules['fallback'],
  gaps: TransformGaps,
  errors: Array<{ message: string; stack?: string }>,
  warnings: string[]
): OpenCodeConfig['commands'] {
  const sourceFile = 'commands.xml';

  return commands.map((command) => {
    // Validate required fields
    if (!command.name) {
      errors.push({ message: `Command missing required field 'name'` });
    }

    let promptTemplate = command.template ?? '';

    // Handle variable interpolation (approximation)
    if (command.variables && command.variables.length > 0) {
      gaps.approximations.push({
        original: `command.${command.name}.variables`,
        approximatedAs: 'template literals in promptTemplate',
        reason: rules.approximations.variables ?? 'Variables inlined',
        sourceFile,
        category: getCategory(rules, 'variables', fallback.category),
      });

      // Add variable descriptions as comments in template
      const varDocs = command.variables
        .map((v) => `{{${v.name}}} - ${v.description ?? v.type ?? 'string'}`)
        .join('\n');
      if (varDocs && promptTemplate) {
        promptTemplate = `# Variables:\n# ${varDocs.replace(/\n/g, '\n# ')}\n\n${promptTemplate}`;
      }
    }

    const result: OpenCodeConfig['commands'][number] = {
      name: command.name,
      description: command.description ?? '',
      promptTemplate,
    };

    // Handle agent reference (approximation)
    if (command.agent) {
      result.config = { agent: command.agent };
      gaps.approximations.push({
        original: `command.${command.name}.agent`,
        approximatedAs: 'config.agent',
        reason: rules.approximations.agent ?? 'Agent stored in config',
        sourceFile,
        category: getCategory(rules, 'agent', fallback.category),
      });
    }

    return result;
  });
}

/**
 * Transform GSD models to OpenCode model configuration.
 */
function transformModels(
  models: GSDModel[],
  rules: SectionRules,
  fallback: TransformRules['fallback'],
  gaps: TransformGaps,
  errors: Array<{ message: string; stack?: string }>,
  _warnings: string[]
): OpenCodeConfig['models'] {
  const sourceFile = 'models.xml';

  return models.map((model) => {
    // Validate required fields
    if (!model.name) {
      errors.push({ message: `Model missing required field 'name'` });
    }
    if (!model.provider) {
      errors.push({ message: `Model '${model.name}' missing required field 'provider'` });
    }

    const result: OpenCodeConfig['models'][number] = {
      modelId: model.name,
      provider: model.provider,
    };

    if (model.endpoint) {
      result.endpoint = model.endpoint;
    }

    // Handle config approximation
    if (model.config && Object.keys(model.config).length > 0) {
      result.config = model.config;
      gaps.approximations.push({
        original: `model.${model.name}.config`,
        approximatedAs: 'config object',
        reason: rules.approximations.config ?? 'Config merged into model',
        sourceFile,
        category: getCategory(rules, 'config', fallback.category),
      });
    }

    return result;
  });
}

/**
 * Transform GSD config to OpenCode settings.
 */
function transformConfig(
  config: GSDConfig,
  rules: SectionRules,
  fallback: TransformRules['fallback'],
  gaps: TransformGaps,
  warnings: string[]
): OpenCodeConfig['settings'] {
  const sourceFile = 'config.xml';
  const settings: OpenCodeConfig['settings'] = {};

  // Direct mappings
  if (config.theme) {
    settings.theme = config.theme;
  }
  if (config.keybindings) {
    settings.keybindings = config.keybindings;
  }

  // Handle permissions (gap - not supported)
  if (config.permissions && Object.keys(config.permissions).length > 0) {
    gaps.unmappedFields.push({
      field: 'config.permissions',
      value: config.permissions,
      reason: 'GSD permissions not supported by OpenCode',
      sourceFile,
      category: getCategory(rules, 'permissions', fallback.category),
      suggestion: getSuggestion(rules, 'permissions', fallback.suggestion),
    });
    warnings.push(
      `GSD permissions not supported by OpenCode: ${Object.keys(config.permissions).join(', ')}`
    );
  }

  // Handle custom config (approximation)
  if (config.custom && Object.keys(config.custom).length > 0) {
    Object.assign(settings, config.custom);
    gaps.approximations.push({
      original: 'config.custom',
      approximatedAs: 'merged into settings',
      reason: rules.approximations.custom ?? 'Custom config merged',
      sourceFile,
      category: getCategory(rules, 'custom', fallback.category),
    });
  }

  return settings;
}
