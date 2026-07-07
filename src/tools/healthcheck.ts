import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBridgeHealthcheckTool } from '@chrischall/mcp-utils/fetchproxy';
import { BotWallError, type EtixClient } from '../client.js';

/**
 * Round-trip a small public etix.com URL (`/robots.txt`) through the full
 * bridge so the user can tell — with ONE tool call — which hop is broken:
 * the WebSocket bridge, the fetchproxy extension, or Etix itself (a DataDome
 * challenge on the signed-in tab).
 *
 * The probe loop, error classification, bridge projection, result shape, and
 * hint ladder all live in `registerBridgeHealthcheckTool`
 * (`@chrischall/mcp-utils/fetchproxy`). Only the etix-specific bits are wired
 * here:
 *
 *  - `probeFn` routes through `client.fetchHtml`, so the probe exercises the
 *    same bot-wall guard real tools do — a DataDome interstitial on
 *    `/robots.txt` surfaces as a `BotWallError`.
 *  - `classifyThrown` maps that `BotWallError` to a `bot_wall` kind with
 *    DataDome-clear copy (the one error condition etix cares about that the
 *    generic ladder can't name).
 *  - `hints.ok` keeps etix's DataDome-flavored "healthy bridge" copy.
 */

const PROBE_PATH = '/robots.txt';

const DATADOME_HINT =
  "The bridge reached etix.com, but Etix served a DataDome bot-wall " +
  "interstitial instead of content — your signed-in etix.com tab lost its " +
  "DataDome clearance. Open etix.com in your browser, let the page finish " +
  "loading (so the DataDome check clears), then retry.";

export function registerHealthcheckTools(
  server: McpServer,
  client: EtixClient
): void {
  registerBridgeHealthcheckTool({
    server,
    prefix: 'etix',
    probePath: PROBE_PATH,
    hostLabel: 'www.etix.com',
    transport: {
      runProbe: (fetchFn, probePath) => client.runProbe(fetchFn, probePath),
      status: () => client.bridgeStatus(),
    },
    probeFn: (path) => client.fetchHtml(path),
    classifyThrown: (err) =>
      err instanceof BotWallError
        ? { kind: 'bot_wall', hint: DATADOME_HINT }
        : undefined,
    hints: {
      ok:
        `Bridge round-tripped ${PROBE_PATH} successfully. If real tools still ` +
        `fail, the problem is downstream of fetchproxy — most likely a DataDome ` +
        `challenge on your signed-in etix.com tab. Open etix.com, let it finish ` +
        `loading, then retry.`,
    },
  });
}
