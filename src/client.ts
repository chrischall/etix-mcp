// EtixClient is the thin, tool-facing API over an EtixTransport.
//
// Three fetch primitives:
//   - fetchHtml(path)  → raw HTML string (SSR performance / venue pages)
//   - fetchJson(path)  → the consumer `/ticket/api/online/...` JSON
//                        endpoints (search/suggest, geolocation)
//   - postJson(path, body) → JSON POST (geolocation/search)
//
// Etix fronts its consumer site with a DataDome interstitial that a
// server-side fetch can't clear, so every request rides the user's
// signed-in, already-cleared etix.com tab via the fetchproxy bridge.
// When a response IS the bot-wall (the user's tab lost its DataDome
// clearance), classifyBotWall catches it and we raise a typed,
// actionable BotWallError instead of handing a captcha page to a parser.
import { formatApiError } from '@chrischall/mcp-utils';
import { classifyBotWall } from '@chrischall/mcp-utils/fetchproxy';
import type {
  BridgeProbeResult,
  BridgeStatus,
  FetchResult,
  EtixTransport,
} from './transport.js';

/** Raised when a response is a DataDome (or other) bot-wall interstitial
 *  rather than real content — the signed-in etix.com tab needs a refresh. */
export class BotWallError extends Error {
  readonly vendor: string;
  constructor(vendor: string, path: string) {
    super(
      `Etix returned a ${vendor} bot-wall interstitial for ${path} instead of content. ` +
        `Open etix.com in your browser, let the page finish loading (so the ${vendor} ` +
        `check clears), then retry. Requests ride your signed-in etix.com tab — if that ` +
        `tab is challenged, every tool call is too.`
    );
    this.name = 'BotWallError';
    this.vendor = vendor;
  }
}

export interface EtixClientOptions {
  /** Transport used to relay fetches to the user's browser. */
  transport: EtixTransport;
}

export class EtixClient {
  private readonly transport: EtixTransport;

  constructor(opts: EtixClientOptions) {
    this.transport = opts.transport;
  }

  async start(): Promise<void> {
    await this.transport.start();
  }

  async close(): Promise<void> {
    await this.transport.close();
  }

  /** Diagnostic snapshot of the bridge — surfaced by `etix_healthcheck`. */
  bridgeStatus(): BridgeStatus {
    return this.transport.status();
  }

  runProbe(
    fetchFn: (path: string) => Promise<unknown>,
    probePath: string
  ): Promise<BridgeProbeResult> {
    return this.transport.runProbe(fetchFn, probePath);
  }

  /** GET an etix.com path, return the HTML body. Throws on non-2xx or a
   *  bot-wall interstitial. */
  async fetchHtml(path: string): Promise<string> {
    const result = await this.transport.fetch({ path, method: 'GET' });
    this.throwIfNotOk(result, 'GET', path);
    this.throwIfBotWall(result, path);
    return result.body;
  }

  /** GET a consumer `/ticket/api/online/...` JSON endpoint. */
  async fetchJson<T = unknown>(path: string): Promise<T> {
    const result = await this.transport.fetch({ path, method: 'GET' });
    this.throwIfNotOk(result, 'GET', path);
    this.throwIfBotWall(result, path);
    return this.parseJson<T>(result.body, 'GET', path);
  }

  /** POST a JSON body to a consumer endpoint (e.g. geolocation/search). */
  async postJson<T = unknown>(path: string, body: unknown): Promise<T> {
    const result = await this.transport.fetch({
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    this.throwIfNotOk(result, 'POST', path);
    this.throwIfBotWall(result, path);
    return this.parseJson<T>(result.body, 'POST', path);
  }

  private parseJson<T>(body: string, method: string, path: string): T {
    try {
      return JSON.parse(body) as T;
    } catch (e) {
      throw new Error(
        `Etix ${method} ${path} — response was not JSON: ${(e as Error).message}`
      );
    }
  }

  private throwIfNotOk(result: FetchResult, method: string, path: string): void {
    if (result.status >= 200 && result.status < 300) return;
    // `formatApiError` redacts secrets (Bearer/JWT) BEFORE truncating, so
    // an Etix error page that echoes a session token can't leak into a
    // tool result. Whitespace-collapse first to keep a single-line preview.
    const collapsed = result.body.replace(/\s+/g, ' ').trim();
    throw new Error(
      formatApiError(result.status, method, path, collapsed, { service: 'Etix' })
    );
  }

  private throwIfBotWall(result: FetchResult, path: string): void {
    const verdict = classifyBotWall(result.body, result.status);
    if (verdict.blocked) {
      throw new BotWallError(verdict.vendor ?? 'bot-wall', path);
    }
  }
}
