// Transport-agnostic interface for the bridge that relays Etix fetches
// through the user's real browser session.
//
// The default implementation in src/transport-fetchproxy.ts wraps
// @fetchproxy/server's FetchproxyServer (127.0.0.1:37149 WebSocket).
// Etix puts its consumer site behind a DataDome interstitial that a
// server-side fetch can't clear, so every request rides the user's
// signed-in, already-cleared etix.com tab.
//
// EtixClient (src/client.ts) accepts any EtixTransport. Error mapping
// (non-2xx, bot-wall interstitial) lives on the client, not the
// transport — every implementation only has to round-trip the request
// and return a {status, body, url} triple.

export interface FetchInit {
  /** Path-and-query relative to https://www.etix.com, e.g.
   *  `/ticket/api/online/search/suggest?keywords=jazz` or
   *  `/ticket/p/39004863`. */
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  /** Serialized request body. JSON callers stringify before calling.
   *  Omitted for GETs. */
  body?: string;
}

export interface FetchResult {
  status: number;
  /** Response body as a string. Empty string for 204. */
  body: string;
  /** Final URL after redirects. */
  url: string;
}

/**
 * Diagnostic snapshot returned by `EtixTransport.status()`. As of 0.8.0
 * the underlying fetchproxy server emits a `BridgeHealth` that is the
 * canonical shape — `BridgeStatus` is now a type alias so any downstream
 * code that still imports it from here keeps working.
 */
export type BridgeStatus =
  import('@chrischall/mcp-utils/fetchproxy').BridgeHealth;

/** 0.10.0+ result of `EtixTransport.runProbe` — projection of the
 *  underlying `@chrischall/mcp-utils/fetchproxy` `BridgeProbeResult`. */
export type BridgeProbeResult =
  import('@chrischall/mcp-utils/fetchproxy').BridgeProbeResult;

export interface EtixTransport {
  /** Bring the transport up. Idempotent. */
  start(): Promise<void>;

  /** Tear the transport down. Idempotent. */
  close(): Promise<void>;

  /** Round-trip one request through the bridge. Resolves to a result
   *  triple even for non-2xx statuses — the client maps HTTP errors. */
  fetch(init: FetchInit): Promise<FetchResult>;

  /** 0.10.0+: run one healthcheck probe through `fetchFn`, measure the
   *  elapsed round-trip, classify any thrown error, and project the
   *  post-probe bridge health. The tool's hint text stays in the
   *  consumer. */
  runProbe(
    fetchFn: (path: string) => Promise<unknown>,
    probePath: string
  ): Promise<BridgeProbeResult>;

  /** Diagnostic snapshot of the bridge. Safe to call any time. */
  status(): BridgeStatus;
}
