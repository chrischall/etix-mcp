// Adapter that lets @fetchproxy/server's FetchproxyServer satisfy
// etix-mcp's EtixTransport interface.
//
// The verb surface (fetch / runProbe / status / start / close) is the
// shared `createFetchproxyTransport` from @chrischall/mcp-utils/fetchproxy.
// It owns request assembly (subdomain default, header/body passthrough,
// {status, body, url} projection), the runProbe passthrough, and the
// bridgeHealth() snapshot — the same methods redfin / homes / compass /
// zillow each wrap verbatim. This thin class keeps only ETIX_DEBUG
// per-request timing and the named export so index.ts / downstream
// importers are unchanged. The startup banner is emitted by the factory
// itself (via `logListening: true`).
//
// IMPORTANT: the whole fetchproxy fleet binds the SAME concentrator port
// (37149). The Transporter browser extension dials that one port; the
// first server to bind is host, the rest peer through it. A new
// fetchproxy MCP MUST default to 37149 or the extension never connects.

import {
  createFetchproxyTransport,
  type FetchproxyTransport as FetchproxyVerbTransport,
  FetchproxyBridgeDownError,
  FetchproxyTimeoutError,
  FetchproxyProtocolError,
  classifyBridgeError,
  type BridgeError,
} from '@chrischall/mcp-utils/fetchproxy';
import type {
  BridgeProbeResult,
  BridgeStatus,
  FetchInit,
  FetchResult,
  EtixTransport,
} from './transport.js';

// Re-exported so downstream callers (healthcheck, future tools) can still
// `import { FetchproxyBridgeDownError } from './transport-fetchproxy.js'`.
export {
  FetchproxyBridgeDownError,
  FetchproxyTimeoutError,
  FetchproxyProtocolError,
  classifyBridgeError,
};
export type { BridgeError };

const DEFAULT_PORT = 37_149;

const DEBUG = process.env.ETIX_DEBUG === '1';

function log(...args: unknown[]): void {
  if (DEBUG) console.error('[etix-mcp:bridge]', ...args);
}

export interface FetchproxyTransportOptions {
  port?: number;
  /** MCP server name announced to the extension. Defaults to 'etix-mcp'. */
  server?: string;
  /** MCP server version. Should match package.json + the banner in index.ts. */
  version: string;
  /** Per-request timeout in ms. Omit to use the server's 30s default. */
  fetchTimeoutMs?: number;
}

export class FetchproxyTransport implements EtixTransport {
  private readonly inner: FetchproxyVerbTransport;
  private readonly port: number;
  private readonly serverVersion: string;

  constructor(opts: FetchproxyTransportOptions) {
    this.port = opts.port ?? DEFAULT_PORT;
    this.serverVersion = opts.version;
    this.inner = createFetchproxyTransport<FetchproxyVerbTransport>({
      port: this.port,
      serverName: opts.server ?? 'etix-mcp',
      version: opts.version,
      // The factory owns the canonical
      // `[etix-mcp:bridge] listening on 127.0.0.1:<port> (role=…, version=…)`
      // startup banner (stderr only).
      logListening: true,
      // Subdomains of etix.com (www, api, cdn, etc.) match automatically.
      domains: ['etix.com'],
      // The verb adapters apply subdomain 'www' per call unless overridden.
      defaultSubdomain: 'www',
      ...(opts.fetchTimeoutMs !== undefined
        ? { fetchTimeoutMs: opts.fetchTimeoutMs }
        : {}),
    });
  }

  async start(): Promise<void> {
    log('listen start', { port: this.port, version: this.serverVersion });
    await this.inner.start();
  }

  async close(): Promise<void> {
    log('close');
    return this.inner.close();
  }

  status(): BridgeStatus {
    return this.inner.status();
  }

  async fetch(init: FetchInit): Promise<FetchResult> {
    const start = Date.now();
    log('fetch:start', {
      method: init.method,
      path: init.path,
      role: this.inner.role,
      port: this.port,
    });
    const response = await this.inner.fetch({
      method: init.method,
      path: init.path,
      headers: init.headers,
      body: init.body,
    });
    const elapsed = Date.now() - start;
    log('fetch:done', {
      path: init.path,
      elapsed,
      status: response.status,
      bodyLen: response.body.length,
    });
    return { status: response.status, body: response.body, url: response.url };
  }

  async runProbe(
    fetchFn: (path: string) => Promise<unknown>,
    probePath: string
  ): Promise<BridgeProbeResult> {
    return this.inner.runProbe(fetchFn, probePath);
  }
}
