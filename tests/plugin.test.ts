import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plugin = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8')) as Record<
  string,
  unknown
>;

/**
 * Claude Code reads the plugin's MCP config from `mcpServers`; an `mcp` key is
 * an unknown field it ignores (`claude plugin validate` warns). It only worked
 * here because `./.mcp.json` is the default path anyway.
 */
describe('.claude-plugin/plugin.json', () => {
  it('declares its MCP config under mcpServers, not the ignored mcp key', () => {
    expect(plugin).not.toHaveProperty('mcp');
    expect(plugin.mcpServers).toBe('./.mcp.json');
  });

  it('points mcpServers at a file that exists', () => {
    expect(existsSync(join(root, plugin.mcpServers as string))).toBe(true);
  });
});
