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

/**
 * A git-source marketplace install never builds the repo, so `dist/` (gitignored)
 * is absent and a `node ${CLAUDE_PLUGIN_ROOT}/dist/...` launch fails to connect
 * (fleet-audit#1195). The plugin launches the published npm package instead.
 */
describe('.mcp.json', () => {
  const mcp = JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')) as {
    mcpServers: Record<string, { command: string; args: string[] }>;
  };
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string };

  it('launches the published package with npx, never a dist/ path', () => {
    for (const server of Object.values(mcp.mcpServers)) {
      expect(server.command).toBe('npx');
      expect(server.args).toEqual(['-y', pkg.name]);
      expect(JSON.stringify(server)).not.toContain('dist/');
    }
  });
});
