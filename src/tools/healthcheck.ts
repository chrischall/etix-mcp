import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EtixClient } from '../client.js';
import { textResult } from '../mcp.js';
import {
  FetchproxyBridgeDownError,
  FetchproxyTimeoutError,
} from '../transport-fetchproxy.js';

/**
 * Round-trip a no-op request through the full bridge so the user can tell
 * — with ONE tool call, without needing a real search — whether:
 *
 *   - etix-mcp's WebSocket bridge is up (`bridge.role` non-null)
 *   - the fetchproxy browser extension is connected (request reaches a
 *     tab and a response comes back)
 *   - the active etix.com tab is responsive (the fetch resolved in time)
 *
 * Probe target: `/robots.txt` on etix.com. It's small, public, and
 * served from Etix's edge — so a failure here cleanly isolates the
 * bridge from Etix's own DataDome / SSR pipeline. If `/robots.txt`
 * round-trips OK but a real tool still fails, the problem is downstream
 * of fetchproxy (a DataDome challenge on the signed-in tab, etc.).
 */

interface HealthcheckResult {
  ok: boolean;
  bridge: {
    role: 'host' | 'peer' | null;
    port: number;
    server_version: string;
    fetch_timeout_ms: number;
    last_success_at: number | null;
    last_failure_at: number | null;
    last_failure_reason: string | null;
    consecutive_failures: number;
  };
  probe: {
    url: string;
    elapsed_ms: number;
    status?: number;
    body_length?: number;
  };
  error?: {
    kind: 'timeout' | 'transport' | 'bridge_down' | 'other';
    message: string;
    role_at_failure?: 'host' | 'peer' | null;
    elapsed_ms_at_timeout?: number;
    bridge_hint?: string;
  };
  hint: string;
}

const PROBE_PATH = '/robots.txt';
const DEFAULT_PORT = 37_149;

function hintFor(args: {
  ok: boolean;
  role: 'host' | 'peer' | null;
  errorKind?: 'timeout' | 'transport' | 'bridge_down' | 'other';
}): string {
  if (args.ok) {
    return `Bridge round-tripped /robots.txt successfully. If real tools still fail, the problem is downstream of fetchproxy — most likely a DataDome challenge on your signed-in etix.com tab. Open etix.com, let it finish loading, then retry.`;
  }
  if (args.errorKind === 'bridge_down') {
    return `The fetchproxy browser extension's service worker is not responding. Chrome evicts extension service workers after ~30s idle by default — this looks like that case. Wake it by clicking the fetchproxy extension icon (or opening any etix.com tab and reloading), then retry. If it keeps happening, reload the extension from chrome://extensions.`;
  }
  if (args.role === null) {
    return `The bridge never bound a role. listen() may have failed silently on startup. Check stderr from etix-mcp for an error during start, and confirm port ${DEFAULT_PORT} isn't blocked.`;
  }
  if (args.errorKind === 'timeout') {
    return `Bridge is alive (role=${args.role}), but the request didn't get a response in time. Either (a) the fetchproxy browser extension isn't connected to this MCP yet — open the extension popup and check for a green dot next to "etix-mcp", or (b) the signed-in etix.com tab is sleeping / closed. Open etix.com in your browser, then retry.`;
  }
  if (args.errorKind === 'transport') {
    return `The bridge returned a protocol error before any HTTP response. Most commonly: no etix.com tab is open, or the extension declined the request. Open etix.com and retry.`;
  }
  return `Unexpected error — see the error.message field for details.`;
}

export function registerHealthcheckTools(
  server: McpServer,
  client: EtixClient
): void {
  server.registerTool(
    'etix_healthcheck',
    {
      title: 'Verify the fetchproxy bridge end-to-end',
      description:
        "Round-trips a small public Etix URL (/robots.txt) through the fetchproxy bridge and returns diagnostics: the bridge's role (host/peer/null), port, version, the elapsed round-trip time, and a plain-English hint that distinguishes 'bridge never came up' from 'extension not connected' from 'real Etix-side problem (DataDome)'. Call this when a real Etix tool fails and you want to know which hop broke. Read-only, no auth required.",
      annotations: {
        title: 'Verify the fetchproxy bridge end-to-end',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {},
    },
    async () => {
      let bodyLength = 0;
      let thrown: unknown;
      const probeResult = await client.runProbe(async (path) => {
        try {
          const html = await client.fetchHtml(path);
          bodyLength = html.length;
          return html;
        } catch (e) {
          thrown = e;
          throw e;
        }
      }, PROBE_PATH);

      const bridge = probeResult.bridge;
      const probe: HealthcheckResult['probe'] = probeResult.ok
        ? {
            url: `https://www.etix.com${PROBE_PATH}`,
            elapsed_ms: probeResult.elapsed_ms,
            status: 200,
            body_length: bodyLength,
          }
        : {
            url: `https://www.etix.com${PROBE_PATH}`,
            elapsed_ms: probeResult.elapsed_ms,
          };

      let error: HealthcheckResult['error'];
      if (probeResult.error) {
        const { kind, message } = probeResult.error;
        switch (kind) {
          case 'timeout': {
            const te = thrown as FetchproxyTimeoutError;
            error = {
              kind: 'timeout',
              message,
              role_at_failure: te.role,
              elapsed_ms_at_timeout: te.elapsedMs,
            };
            break;
          }
          case 'bridge_down': {
            const bd = thrown as FetchproxyBridgeDownError;
            error = {
              kind: 'bridge_down',
              message,
              role_at_failure: bd.role,
              bridge_hint: bd.hint,
            };
            break;
          }
          case 'http':
          case 'protocol':
            error = { kind: 'transport', message };
            break;
          case 'other':
          default:
            error = { kind: 'other', message };
            break;
        }
      }

      const result: HealthcheckResult = {
        ok: probeResult.ok,
        bridge: {
          role: bridge.role,
          port: bridge.port,
          server_version: bridge.server_version,
          fetch_timeout_ms: bridge.fetch_timeout_ms,
          last_success_at: bridge.last_success_at,
          last_failure_at: bridge.last_failure_at,
          last_failure_reason: bridge.last_failure_reason,
          consecutive_failures: bridge.consecutive_failures,
        },
        probe,
        ...(error ? { error } : {}),
        hint: hintFor({
          ok: probeResult.ok,
          role: bridge.role,
          errorKind: error?.kind,
        }),
      };
      return textResult(result);
    }
  );
}
