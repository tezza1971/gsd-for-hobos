import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadOpenCodeDocs } from './downloader.js';
import * as fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn()
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('downloadOpenCodeDocs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully downloads README and writes metadata', async () => {
    // Mock successful fetch
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '# OpenCode\n\nDocumentation content...'
    });

    const result = await downloadOpenCodeDocs();

    // Should succeed
    expect(result.success).toBe(true);
    expect(result.cached).toBe(false);
    expect(result.error).toBeUndefined();

    // Should create cache directory
    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('docs-opencode'),
      { recursive: true }
    );

    // Should write README
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('README.md'),
      expect.stringContaining('# OpenCode'),
      'utf-8'
    );

    // Should write metadata.json
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('metadata.json'),
      expect.stringContaining('downloadedAt'),
      'utf-8'
    );
  });

  it('handles HTTP 404 error gracefully', async () => {
    // Mock 404 response
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found'
    });

    const result = await downloadOpenCodeDocs();

    // Should fail with HTTP status
    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 404');
    expect(result.cached).toBe(false);

    // Should not write files
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('handles network error gracefully', async () => {
    // Mock fetch throwing network error
    mockFetch.mockRejectedValue(new Error('fetch failed: ENOTFOUND'));

    const result = await downloadOpenCodeDocs();

    // Should fail with network error
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
    expect(result.error).toContain('ENOTFOUND');
    expect(result.cached).toBe(false);

    // Should not write files
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('handles write error gracefully', async () => {
    // Mock successful fetch
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '# OpenCode'
    });

    // Mock mkdir succeeding but writeFile failing
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('EACCES: permission denied'));

    const result = await downloadOpenCodeDocs();

    // Should fail with write error
    expect(result.success).toBe(false);
    expect(result.error).toContain('Write failed');
    expect(result.error).toContain('EACCES');
    expect(result.cached).toBe(false);
  });

  it('creates valid metadata.json structure', async () => {
    // Mock successful fetch
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '# OpenCode'
    });

    // Mock successful file operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await downloadOpenCodeDocs();

    // Find the metadata.json writeFile call
    const metadataCall = vi.mocked(fs.writeFile).mock.calls.find(
      call => String(call[0]).includes('metadata.json')
    );

    expect(metadataCall).toBeDefined();

    // Parse the metadata content
    const metadataContent = JSON.parse(metadataCall![1] as string);

    // Verify structure
    expect(metadataContent).toHaveProperty('downloadedAt');
    expect(metadataContent).toHaveProperty('source');

    // Verify timestamp format (ISO 8601)
    expect(metadataContent.downloadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // Verify source URL
    expect(metadataContent.source).toContain('githubusercontent.com');
    expect(metadataContent.source).toContain('opencode');
    expect(metadataContent.source).toContain('README.md');
  });

  it('calls fetch with correct GitHub URL', async () => {
    // Mock successful fetch
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '# OpenCode'
    });

    await downloadOpenCodeDocs();

    // Verify fetch was called with correct URL
    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/OpenAgentsInc/opencode/main/README.md'
    );
  });
});
