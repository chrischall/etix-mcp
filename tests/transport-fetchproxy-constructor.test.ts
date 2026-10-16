// Constructor-options tests for createEtixTransport. It is a thin call to
// `createFetchproxyTransport` (the shared verb adapter), so the opts are
// asserted on the factory call and the returned transport is the factory's
// own object — no delegating wrapper (fleet-audit#1240).
import { describe, it, expect, beforeEach } from 'vitest';
import type { CreateFetchproxyTransportOptions } from '@chrischall/mcp-utils/fetchproxy';
import { vi } from 'vitest';

const factoryCalls: CreateFetchproxyTransportOptions[] = [];
const sentinel = { role: 'mock' };

vi.mock('@chrischall/mcp-utils/fetchproxy', async () => {
  const actual =
    await vi.importActual<typeof import('@chrischall/mcp-utils/fetchproxy')>(
      '@chrischall/mcp-utils/fetchproxy'
    );
  return {
    ...actual,
    createFetchproxyTransport: (opts: CreateFetchproxyTransportOptions) => {
      factoryCalls.push(opts);
      return sentinel;
    },
  };
});

beforeEach(() => {
  factoryCalls.length = 0;
});

async function load() {
  return import('../src/transport-fetchproxy.js');
}

describe('createEtixTransport — factory options', () => {
  it('binds the shared fleet port (37149) and etix.com domain', async () => {
    const { createEtixTransport } = await load();
    createEtixTransport({ version: '0.0.0-test' });
    expect(factoryCalls.length).toBe(1);
    expect(factoryCalls[0]!.port).toBe(37_149);
    expect(factoryCalls[0]!.defaultSubdomain).toBe('www');
    expect(factoryCalls[0]!.serverName).toBe('etix-mcp');
    expect(factoryCalls[0]!.version).toBe('0.0.0-test');
    expect(factoryCalls[0]!.domains).toEqual(['etix.com']);
  });

  it('passes logListening:true so the factory emits the startup banner', async () => {
    const { createEtixTransport } = await load();
    createEtixTransport({ version: '0.0.0-test' });
    expect(factoryCalls[0]!.logListening).toBe(true);
  });

  it('gates per-request debug logging on ETIX_DEBUG via the factory (truthy parse, placeholders unset)', async () => {
    const { createEtixTransport } = await load();
    createEtixTransport({ version: '0.0.0-test' });
    expect(factoryCalls[0]!.debugEnvVar).toBe('ETIX_DEBUG');
  });

  it('does NOT pass keepAliveIntervalMs — relies on the server-side 25s default', async () => {
    const { createEtixTransport } = await load();
    createEtixTransport({ version: '0.0.0-test' });
    expect(factoryCalls[0]!.keepAliveIntervalMs).toBeUndefined();
  });

  it('omits fetchTimeoutMs when not explicitly provided', async () => {
    const { createEtixTransport } = await load();
    createEtixTransport({ version: '0.0.0-test' });
    expect('fetchTimeoutMs' in factoryCalls[0]!).toBe(false);
  });

  it('forwards fetchTimeoutMs when explicitly provided', async () => {
    const { createEtixTransport } = await load();
    createEtixTransport({ version: '0.0.0-test', fetchTimeoutMs: 20_000 });
    expect(factoryCalls[0]!.fetchTimeoutMs).toBe(20_000);
  });

  it('honours an explicit port override', async () => {
    const { createEtixTransport } = await load();
    createEtixTransport({ version: '0.0.0-test', port: 40_000 });
    expect(factoryCalls[0]!.port).toBe(40_000);
  });

  it('returns the factory transport itself, not a wrapper', async () => {
    const { createEtixTransport } = await load();
    expect(createEtixTransport({ version: '0.0.0-test' })).toBe(sentinel);
  });
});
