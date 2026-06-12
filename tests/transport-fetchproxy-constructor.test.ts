// Constructor-options tests for FetchproxyTransport. The class delegates
// its FetchproxyServer construction to `createFetchproxyTransport` (the
// shared verb adapter), so the opts are asserted on the factory call —
// the factory forwards the full FetchproxyServerOpts verbatim, so the
// same knobs (defaultSubdomain, fetchTimeoutMs, keepAliveIntervalMs) ride
// through.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateFetchproxyTransportOptions } from '@chrischall/mcp-utils/fetchproxy';

const factoryCalls: CreateFetchproxyTransportOptions[] = [];

vi.mock('@chrischall/mcp-utils/fetchproxy', async () => {
  const actual =
    await vi.importActual<typeof import('@chrischall/mcp-utils/fetchproxy')>(
      '@chrischall/mcp-utils/fetchproxy'
    );
  return {
    ...actual,
    createFetchproxyTransport: (opts: CreateFetchproxyTransportOptions) => {
      factoryCalls.push(opts);
      return { role: 'mock' };
    },
  };
});

beforeEach(() => {
  factoryCalls.length = 0;
});

describe('FetchproxyTransport — constructor options', () => {
  it('binds the shared fleet port (37149) and etix.com domain', async () => {
    const { FetchproxyTransport } = await import(
      '../src/transport-fetchproxy.js'
    );
    new FetchproxyTransport({ version: '0.0.0-test' });
    expect(factoryCalls.length).toBe(1);
    expect(factoryCalls[0]!.port).toBe(37_149);
    expect(factoryCalls[0]!.defaultSubdomain).toBe('www');
    expect(factoryCalls[0]!.serverName).toBe('etix-mcp');
    expect(factoryCalls[0]!.domains).toEqual(['etix.com']);
  });

  it('passes logListening:true so the factory emits the startup banner', async () => {
    const { FetchproxyTransport } = await import(
      '../src/transport-fetchproxy.js'
    );
    new FetchproxyTransport({ version: '0.0.0-test' });
    expect(factoryCalls[0]!.logListening).toBe(true);
  });

  it('does NOT pass keepAliveIntervalMs — relies on the server-side 25s default', async () => {
    const { FetchproxyTransport } = await import(
      '../src/transport-fetchproxy.js'
    );
    new FetchproxyTransport({ version: '0.0.0-test' });
    expect(factoryCalls[0]!.keepAliveIntervalMs).toBeUndefined();
  });

  it('omits fetchTimeoutMs when not explicitly provided', async () => {
    const { FetchproxyTransport } = await import(
      '../src/transport-fetchproxy.js'
    );
    new FetchproxyTransport({ version: '0.0.0-test' });
    expect(factoryCalls[0]!.fetchTimeoutMs).toBeUndefined();
  });

  it('forwards fetchTimeoutMs when explicitly provided', async () => {
    const { FetchproxyTransport } = await import(
      '../src/transport-fetchproxy.js'
    );
    new FetchproxyTransport({ version: '0.0.0-test', fetchTimeoutMs: 20_000 });
    expect(factoryCalls[0]!.fetchTimeoutMs).toBe(20_000);
  });

  it('honours an explicit port override', async () => {
    const { FetchproxyTransport } = await import(
      '../src/transport-fetchproxy.js'
    );
    new FetchproxyTransport({ version: '0.0.0-test', port: 40_000 });
    expect(factoryCalls[0]!.port).toBe(40_000);
  });
});
