import { describe, it, expect, vi, afterAll } from 'vitest';
import type { EtixClient } from '../../src/client.js';
import { registerHealthcheckTools } from '../../src/tools/healthcheck.js';
import { classifyBridgeError } from '../../src/transport-fetchproxy.js';
import type { BridgeProbeResult } from '../../src/transport.js';
import { createTestHarness, parseToolResult } from '../helpers.js';

const BRIDGE = {
  role: 'host' as const,
  port: 37149,
  server_version: '0.1.0',
  fetch_timeout_ms: 30_000,
  last_success_at: null,
  last_failure_at: null,
  last_failure_reason: null,
  consecutive_failures: 0,
};

/** Faithfully reproduce the real client.runProbe contract: run the probe
 *  fn, time it, classify any throw, and project a snake-cased bridge. */
function stubClient(fetchHtml: ReturnType<typeof vi.fn>): EtixClient {
  const runProbe = vi
    .fn()
    .mockImplementation(
      async (
        fn: (p: string) => Promise<unknown>,
        path: string
      ): Promise<BridgeProbeResult> => {
        const start = Date.now();
        try {
          await fn(path);
          return { ok: true, elapsed_ms: Date.now() - start, bridge: BRIDGE };
        } catch (e) {
          const kind = classifyBridgeError(e);
          return {
            ok: false,
            elapsed_ms: Date.now() - start,
            bridge: BRIDGE,
            error: { kind, message: (e as Error).message },
          } as BridgeProbeResult;
        }
      }
    );
  return { fetchHtml, runProbe } as unknown as EtixClient;
}

let harness: Awaited<ReturnType<typeof createTestHarness>>;
afterAll(async () => {
  if (harness) await harness.close();
});

describe('etix_healthcheck', () => {
  it('reports ok with bridge diagnostics on a successful probe', async () => {
    const fetchHtml = vi.fn().mockResolvedValue('User-agent: *');
    harness = await createTestHarness((server) =>
      registerHealthcheckTools(server, stubClient(fetchHtml))
    );
    const res = await harness.callTool('etix_healthcheck', {});
    const data = parseToolResult(res);
    expect(fetchHtml).toHaveBeenCalledWith('/robots.txt');
    expect(data.ok).toBe(true);
    expect(data.bridge.role).toBe('host');
    expect(data.probe.url).toBe('https://www.etix.com/robots.txt');
    expect(data.probe.body_length).toBe('User-agent: *'.length);
    expect(data.hint).toMatch(/DataDome/);
  });

  it('reports a failure with an actionable hint when the probe throws', async () => {
    const fetchHtml = vi.fn().mockRejectedValue(new Error('no etix.com tab'));
    const h = await createTestHarness((server) =>
      registerHealthcheckTools(server, stubClient(fetchHtml))
    );
    const res = await h.callTool('etix_healthcheck', {});
    const data = parseToolResult(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBeDefined();
    expect(data.hint.length).toBeGreaterThan(0);
    await h.close();
  });
});
