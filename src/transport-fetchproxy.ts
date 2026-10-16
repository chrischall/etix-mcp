// The etix.com bridge transport: a thin call to @chrischall/mcp-utils'
// `createFetchproxyTransport`, which owns the FetchproxyServer construction,
// the start/close/status lifecycle, the fetch/runProbe verb adapters, the
// startup banner (`logListening`) and the ETIX_DEBUG per-request logging
// (`debugEnvVar`, parsed with the fleet truthy rules, so `true`/`yes` work and
// an unexpanded `${user_config.debug}` stays off). The returned object
// structurally satisfies `EtixTransport` — no delegating wrapper class.
//
// IMPORTANT: the whole fetchproxy fleet binds the SAME concentrator port
// (37149). The ContextMint Bridge browser extension dials that one port; the
// first server to bind is host, the rest peer through it. A new
// fetchproxy MCP MUST default to 37149 or the extension never connects.

import {
  createFetchproxyTransport,
  FetchproxyBridgeDownError,
  FetchproxyTimeoutError,
  FetchproxyProtocolError,
  classifyBridgeError,
  type BridgeError,
} from '@chrischall/mcp-utils/fetchproxy';
import type { EtixTransport } from './transport.js';
import { DEFAULT_PORT } from './config.js';

// Re-exported so downstream callers (healthcheck, future tools) can still
// `import { FetchproxyBridgeDownError } from './transport-fetchproxy.js'`.
export {
  FetchproxyBridgeDownError,
  FetchproxyTimeoutError,
  FetchproxyProtocolError,
  classifyBridgeError,
};
export type { BridgeError };

export interface EtixTransportOptions {
  port?: number;
  /** MCP server version. Should match package.json + the banner in index.ts. */
  version: string;
  /** Per-request timeout in ms. Omit to use the server's 30s default. */
  fetchTimeoutMs?: number;
}

/**
 * Build the etix.com bridge transport. Construction is cheap; the port binds
 * on `start()`.
 */
export function createEtixTransport(opts: EtixTransportOptions): EtixTransport {
  return createFetchproxyTransport({
    port: opts.port ?? DEFAULT_PORT,
    serverName: 'etix-mcp',
    version: opts.version,
    // Canonical `[etix-mcp:bridge] listening on …` startup banner (stderr).
    logListening: true,
    debugEnvVar: 'ETIX_DEBUG',
    // Subdomains of etix.com (www, api, cdn, etc.) match automatically.
    domains: ['etix.com'],
    // The verb adapters apply subdomain 'www' per call unless overridden.
    defaultSubdomain: 'www',
    ...(opts.fetchTimeoutMs !== undefined ? { fetchTimeoutMs: opts.fetchTimeoutMs } : {}),
  });
}
