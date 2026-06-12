// Server-boot smoke test: spawn the REAL built artifact the way a host
// would and drive the JSON-RPC handshake over stdio.
//
// Why this exists (and unit tests can't catch it): the `.mcpb` bundle
// ships NO node_modules — esbuild inlines everything into dist/bundle.js.
// An eager top-level import of an esbuild-`--external` / optional dep
// (e.g. @fetchproxy/server) would throw `ERR_MODULE_NOT_FOUND` the moment
// the host spawns the server, BEFORE it answers `initialize` — and the
// host just logs "transport closed unexpectedly". We reproduce that exact
// runtime: copy dist/bundle.js + package.json into a temp dir with no
// node_modules, spawn it, and assert the full initialize + tools/list
// handshake succeeds.
//
// Tool count is asserted as `>= EXPECTED.length` (not an exact match) so
// PR CI — which runs the branch merged with main — doesn't break the
// instant another PR adds a tool. The exact roster is owned by
// index.test.ts on its own branch.
import { describe, it, expect, beforeAll } from 'vitest';
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = join(ROOT, 'dist', 'bundle.js');

const EXPECTED = [
  'etix_search',
  'etix_get_event',
  'etix_get_venue',
  'etix_find_location',
  'etix_healthcheck',
];

beforeAll(() => {
  if (!existsSync(BUNDLE)) {
    // Self-contained for local `vitest run`; CI builds before testing.
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  }
}, 120_000);

/** Spawn the bundle in `dir` and run initialize + tools/list. */
async function handshake(dir: string): Promise<string[]> {
  const child = spawn('node', [join(dir, 'bundle.js')], {
    cwd: dir,
    stdio: ['pipe', 'pipe', 'pipe'],
    // Use a throwaway port so the smoke test never elects host/peer
    // against a real fleet server on 37149.
    env: { ...process.env, ETIX_WS_PORT: '47149' },
  });

  let buf = '';
  const tools: string[] = [];
  return new Promise<string[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`timeout — server never answered tools/list. stderr:\n${stderr}`));
    }, 20_000);
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (tools.length === 0) {
        clearTimeout(timer);
        reject(new Error(`server exited (code ${code}) before tools/list. stderr:\n${stderr}`));
      }
    });

    child.stdout.on('data', (d) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: { id?: number; result?: { tools?: Array<{ name: string }> } };
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === 2 && msg.result?.tools) {
          for (const t of msg.result.tools) tools.push(t.name);
          clearTimeout(timer);
          child.kill('SIGTERM');
          resolve(tools);
        }
      }
    });

    const send = (o: unknown) => child.stdin.write(JSON.stringify(o) + '\n');
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'smoke', version: '0' },
      },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  });
}

describe('server boot (.mcpb runtime — no node_modules)', () => {
  it('initializes and lists tools when spawned with no node_modules', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'etix-mcp-boot-'));
    copyFileSync(BUNDLE, join(dir, 'bundle.js'));
    // {"type":"module"} is required for Node to read the bundle as ESM.
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));

    const tools = await handshake(dir);
    expect(tools.length).toBeGreaterThanOrEqual(EXPECTED.length);
    for (const name of EXPECTED) expect(tools).toContain(name);
  }, 30_000);
});
