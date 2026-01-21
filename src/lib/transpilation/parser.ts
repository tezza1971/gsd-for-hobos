import { promises as fs } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import type { GSDParseResult, ParseError } from '../../types/index.js';
import type {
  GSDIntermediate,
  GSDAgent,
  GSDCommand,
  GSDModel,
  GSDConfig,
  GSDGaps,
  GSDSourceMetadata
} from './ir-types.js';

/**
 * Parse GSD context files into Intermediate Representation.
 *
 * Discovers and parses GSD files from the installation directory:
 * - XML files: agents, commands, workflows
 * - Markdown files: templates, documentation
 * - JSON files: config, mappings
 *
 * Handles errors gracefully - continues parsing on individual file errors,
 * accumulating errors and returning partial IR when possible.
 *
 * @param gsdPath - Path to GSD installation directory (e.g., ~/.claude/get-shit-done)
 * @returns Parse result with IR and any errors/warnings
 */
export async function parseGSDFiles(gsdPath: string): Promise<GSDParseResult> {
  const errors: ParseError[] = [];
  const warnings: string[] = [];

  const agents: GSDAgent[] = [];
  const commands: GSDCommand[] = [];
  const models: GSDModel[] = [];
  const config: GSDConfig = {};
  const gaps: GSDGaps = {
    unmappedFields: [],
    approximations: []
  };

  // Check if directory exists
  try {
    await fs.access(gsdPath);
  } catch (err) {
    return {
      success: false,
      errors: [{
        file: gsdPath,
        message: `GSD directory not found: ${gsdPath}`,
        stack: err instanceof Error ? err.stack : undefined
      }],
      warnings: []
    };
  }

  // Discover all files recursively
  const files: string[] = [];
  try {
    await discoverFiles(gsdPath, files);
  } catch (err) {
    return {
      success: false,
      errors: [{
        file: gsdPath,
        message: `Failed to scan GSD directory: ${err instanceof Error ? err.message : String(err)}`,
        stack: err instanceof Error ? err.stack : undefined
      }],
      warnings: []
    };
  }

  // Sort files for deterministic processing (affects hash)
  files.sort();

  // Calculate content hash for idempotency
  let contentHash = '';
  try {
    contentHash = await calculateContentHash(gsdPath, files);
  } catch (err) {
    warnings.push(`Failed to calculate content hash: ${err instanceof Error ? err.message : String(err)}`);
    contentHash = 'unknown';
  }

  // Detect version from package.json if available
  let version: string | undefined;
  const packageJsonPath = join(gsdPath, 'package.json');
  try {
    const packageJson = await fs.readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(packageJson);
    version = pkg.version;
  } catch {
    // Version detection is non-critical
  }

  // Parse each file
  for (const filePath of files) {
    const ext = extname(filePath).toLowerCase();
    const relativePath = relative(gsdPath, filePath);

    try {
      if (ext === '.xml') {
        await parseXMLFile(filePath, relativePath, { agents, commands, models }, gaps, errors);
      } else if (ext === '.md') {
        await parseMarkdownFile(filePath, relativePath, { commands, config }, gaps, errors);
      } else if (ext === '.json' && !filePath.endsWith('package.json')) {
        await parseJSONFile(filePath, relativePath, { config, models }, gaps, errors);
      }
    } catch (err) {
      // Continue parsing even if individual files fail
      errors.push({
        file: relativePath,
        message: `Failed to parse file: ${err instanceof Error ? err.message : String(err)}`,
        stack: err instanceof Error ? err.stack : undefined
      });
    }
  }

  const source: GSDSourceMetadata = {
    path: gsdPath,
    hash: contentHash,
    timestamp: new Date().toISOString(),
    version
  };

  const ir: GSDIntermediate = {
    version: '1.0',
    source,
    agents,
    commands,
    models,
    config,
    gaps
  };

  return {
    success: errors.length === 0,
    ir,
    errors,
    warnings
  };
}

/**
 * Recursively discover files in directory.
 * Skips node_modules, .git, and other common ignore patterns.
 */
async function discoverFiles(dirPath: string, files: string[]): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    // Skip common ignore patterns
    if (entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'build') {
      continue;
    }

    if (entry.isDirectory()) {
      await discoverFiles(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

/**
 * Calculate SHA256 hash of all file contents (sorted by filename).
 * Used for idempotency - same content produces same hash.
 */
async function calculateContentHash(gsdPath: string, files: string[]): Promise<string> {
  const hash = createHash('sha256');

  // Sort files to ensure deterministic ordering
  const sortedFiles = [...files].sort();

  for (const filePath of sortedFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = relative(gsdPath, filePath);
      // Include filename and content in hash
      hash.update(relativePath);
      hash.update(content);
    } catch {
      // Skip files that can't be read (binary files, permission issues)
    }
  }

  return hash.digest('hex');
}

/**
 * Parse XML file (agent, command, or workflow definition).
 * Uses simple regex-based parsing since GSD XML is semantic/lightweight.
 */
async function parseXMLFile(
  filePath: string,
  relativePath: string,
  collections: { agents: GSDAgent[]; commands: GSDCommand[]; models: GSDModel[] },
  gaps: GSDGaps,
  errors: ParseError[]
): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Detect what type of XML file this is
  if (content.includes('<agent>') || content.includes('<agent ')) {
    parseAgentXML(content, relativePath, collections.agents, gaps, errors);
  } else if (content.includes('<command>') || content.includes('<command ')) {
    parseCommandXML(content, relativePath, collections.commands, gaps, errors);
  } else if (content.includes('<model>') || content.includes('<model ')) {
    parseModelXML(content, relativePath, collections.models, gaps, errors);
  }
}

/**
 * Parse agent definition from XML content.
 */
function parseAgentXML(
  content: string,
  relativePath: string,
  agents: GSDAgent[],
  gaps: GSDGaps,
  errors: ParseError[]
): void {
  const nameMatch = content.match(/<name[^>]*>(.*?)<\/name>/s);
  const descMatch = content.match(/<description[^>]*>(.*?)<\/description>/s);
  const modelMatch = content.match(/<model[^>]*>(.*?)<\/model>/s);
  const tempMatch = content.match(/<temperature[^>]*>(.*?)<\/temperature>/s);
  const promptMatch = content.match(/<(?:system-prompt|systemPrompt)[^>]*>(.*?)<\/(?:system-prompt|systemPrompt)>/s);
  const toolsMatch = content.match(/<tools[^>]*>(.*?)<\/tools>/s);
  const maxTokensMatch = content.match(/<(?:max-tokens|maxTokens)[^>]*>(.*?)<\/(?:max-tokens|maxTokens)>/s);

  if (!nameMatch) {
    errors.push({
      file: relativePath,
      message: 'Agent XML missing required <name> tag',
      line: findLineNumber(content, '<agent')
    });
    return;
  }

  const agent: GSDAgent = {
    name: nameMatch[1].trim(),
    description: descMatch ? descMatch[1].trim() : undefined,
    model: modelMatch ? modelMatch[1].trim() : undefined,
    temperature: tempMatch ? parseFloat(tempMatch[1].trim()) : undefined,
    systemPrompt: promptMatch ? promptMatch[1].trim() : undefined,
    maxTokens: maxTokensMatch ? parseInt(maxTokensMatch[1].trim(), 10) : undefined
  };

  // Parse tools list
  if (toolsMatch) {
    const toolsList = toolsMatch[1].match(/<tool[^>]*>(.*?)<\/tool>/gs);
    if (toolsList) {
      agent.tools = toolsList.map(tool => {
        const match = tool.match(/<tool[^>]*>(.*?)<\/tool>/s);
        return match ? match[1].trim() : '';
      }).filter(Boolean);
    }
  }

  agents.push(agent);
}

/**
 * Parse command definition from XML content.
 */
function parseCommandXML(
  content: string,
  relativePath: string,
  commands: GSDCommand[],
  gaps: GSDGaps,
  errors: ParseError[]
): void {
  const nameMatch = content.match(/<name[^>]*>(.*?)<\/name>/s);
  const descMatch = content.match(/<description[^>]*>(.*?)<\/description>/s);
  const templateMatch = content.match(/<template[^>]*>(.*?)<\/template>/s);
  const agentMatch = content.match(/<agent[^>]*>(.*?)<\/agent>/s);

  if (!nameMatch) {
    errors.push({
      file: relativePath,
      message: 'Command XML missing required <name> tag',
      line: findLineNumber(content, '<command')
    });
    return;
  }

  const command: GSDCommand = {
    name: nameMatch[1].trim(),
    description: descMatch ? descMatch[1].trim() : undefined,
    template: templateMatch ? templateMatch[1].trim() : undefined,
    agent: agentMatch ? agentMatch[1].trim() : undefined
  };

  // Parse variables
  const variablesMatch = content.match(/<variables[^>]*>(.*?)<\/variables>/s);
  if (variablesMatch) {
    const variablesList = variablesMatch[1].match(/<variable[^>]*>.*?<\/variable>/gs);
    if (variablesList) {
      command.variables = variablesList.map(varXml => {
        const varNameMatch = varXml.match(/<name[^>]*>(.*?)<\/name>/s);
        const varTypeMatch = varXml.match(/<type[^>]*>(.*?)<\/type>/s);
        const varDescMatch = varXml.match(/<description[^>]*>(.*?)<\/description>/s);
        const varDefaultMatch = varXml.match(/<default[^>]*>(.*?)<\/default>/s);
        const varRequiredMatch = varXml.match(/<required[^>]*>(.*?)<\/required>/s);

        return {
          name: varNameMatch ? varNameMatch[1].trim() : '',
          type: varTypeMatch ? varTypeMatch[1].trim() as any : undefined,
          description: varDescMatch ? varDescMatch[1].trim() : undefined,
          default: varDefaultMatch ? varDefaultMatch[1].trim() : undefined,
          required: varRequiredMatch ? varRequiredMatch[1].trim() === 'true' : undefined
        };
      }).filter(v => v.name);
    }
  }

  commands.push(command);
}

/**
 * Parse model definition from XML content.
 */
function parseModelXML(
  content: string,
  relativePath: string,
  models: GSDModel[],
  gaps: GSDGaps,
  errors: ParseError[]
): void {
  const nameMatch = content.match(/<name[^>]*>(.*?)<\/name>/s);
  const providerMatch = content.match(/<provider[^>]*>(.*?)<\/provider>/s);
  const endpointMatch = content.match(/<endpoint[^>]*>(.*?)<\/endpoint>/s);

  if (!nameMatch || !providerMatch) {
    errors.push({
      file: relativePath,
      message: 'Model XML missing required <name> or <provider> tag',
      line: findLineNumber(content, '<model')
    });
    return;
  }

  const model: GSDModel = {
    name: nameMatch[1].trim(),
    provider: providerMatch[1].trim(),
    endpoint: endpointMatch ? endpointMatch[1].trim() : undefined
  };

  models.push(model);
}

/**
 * Parse Markdown file (template or documentation).
 * Extracts frontmatter and content.
 */
async function parseMarkdownFile(
  filePath: string,
  relativePath: string,
  collections: { commands: GSDCommand[]; config: GSDConfig },
  gaps: GSDGaps,
  errors: ParseError[]
): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Extract frontmatter if present
  const frontmatterMatch = content.match(/^---\s*\n(.*?)\n---\s*\n/s);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];

    // Simple YAML-like parsing for frontmatter
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    const typeMatch = frontmatter.match(/^type:\s*(.+)$/m);

    // If this looks like a command template
    if (nameMatch && typeMatch?.includes('command')) {
      const command: GSDCommand = {
        name: nameMatch[1].trim(),
        description: descMatch ? descMatch[1].trim() : undefined,
        template: content.substring(frontmatterMatch[0].length).trim()
      };
      collections.commands.push(command);
    }
  }
}

/**
 * Parse JSON file (config or mappings).
 */
async function parseJSONFile(
  filePath: string,
  relativePath: string,
  collections: { config: GSDConfig; models: GSDModel[] },
  gaps: GSDGaps,
  errors: ParseError[]
): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');

  try {
    const json = JSON.parse(content);

    // If this looks like a config file
    if (json.theme || json.keybindings || json.permissions) {
      if (json.theme) collections.config.theme = json.theme;
      if (json.keybindings) collections.config.keybindings = json.keybindings;
      if (json.permissions) collections.config.permissions = json.permissions;

      // Capture any other fields as custom config
      const knownKeys = new Set(['theme', 'keybindings', 'permissions']);
      const customFields = Object.keys(json).filter(k => !knownKeys.has(k));
      if (customFields.length > 0) {
        if (!collections.config.custom) collections.config.custom = {};
        for (const key of customFields) {
          collections.config.custom[key] = json[key];
        }
      }
    }

    // If this looks like a models file
    if (json.models && Array.isArray(json.models)) {
      for (const modelData of json.models) {
        if (modelData.name && modelData.provider) {
          collections.models.push({
            name: modelData.name,
            provider: modelData.provider,
            endpoint: modelData.endpoint,
            config: modelData.config
          });
        }
      }
    }
  } catch (err) {
    errors.push({
      file: relativePath,
      message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      line: findJSONErrorLine(content, err)
    });
  }
}

/**
 * Find line number of a string in content (1-indexed).
 */
function findLineNumber(content: string, search: string): number {
  const index = content.indexOf(search);
  if (index === -1) return 1;

  return content.substring(0, index).split('\n').length;
}

/**
 * Extract line number from JSON parse error if available.
 */
function findJSONErrorLine(content: string, error: unknown): number | undefined {
  if (error instanceof SyntaxError) {
    const match = error.message.match(/position (\d+)/);
    if (match) {
      const position = parseInt(match[1], 10);
      return content.substring(0, position).split('\n').length;
    }
  }
  return undefined;
}
