#!/usr/bin/env node
// etix-mcp entrypoint.
//
// Boot sequence:
//   1. Construct a FetchproxyTransport listening on 127.0.0.1:37149.
//      The shared fetchproxy Chrome/Safari extension — installed
//      separately, not in this repo — connects here.
//      See https://github.com/chrischall/fetchproxy.
//   2. EtixClient.start() — brings the transport up. This runs BEFORE
//      runMcp connects stdio, preserving the deferred-config-error
//      pattern: a bridge that can't come up surfaces here, before the
//      host's first tool call, rather than wedging the JSON-RPC channel.
//   3. runMcp registers tool handlers, prints the stderr banner, wires
//      SIGINT/SIGTERM → client.close(), and connects the MCP server to
//      stdio for the host client.
//
// Etix has no consumer API key and its consumer site sits behind a
// DataDome interstitial, so every request rides the user's signed-in,
// already-cleared etix.com browser tab via the fetchproxy bridge. No
// Etix account is required — this is public event-discovery data.
import { runMcp, readEnvVar } from '@chrischall/mcp-utils';
import { EtixClient } from './client.js';
import { FetchproxyTransport } from './transport-fetchproxy.js';
import { registerSearchTools } from './tools/search.js';
import { registerEventTools } from './tools/event.js';
import { registerVenueTools } from './tools/venue.js';
import { registerLocationTools } from './tools/location.js';
import { registerHealthcheckTools } from './tools/healthcheck.js';
import { VERSION } from './version.js';

const portRaw = readEnvVar('ETIX_WS_PORT');
const port = portRaw ? Number(portRaw) : undefined;

const transport = new FetchproxyTransport({ port, version: VERSION });

const client = new EtixClient({ transport });
// Bring the bridge up BEFORE runMcp connects stdio (deferred-config-error
// pattern — a failure here surfaces before any tool call).
await client.start();

await runMcp({
  name: 'etix-mcp',
  version: VERSION,
  deps: client,
  tools: [
    (server) => registerSearchTools(server, client),
    (server) => registerEventTools(server, client),
    (server) => registerVenueTools(server, client),
    (server) => registerLocationTools(server, client),
    (server) => registerHealthcheckTools(server, client),
  ],
  banner:
    `[etix-mcp] v${VERSION} — WebSocket bridge via @fetchproxy/server on 127.0.0.1:${port ?? 37149}. ` +
    'Install the fetchproxy extension (see https://github.com/chrischall/fetchproxy) ' +
    'and open etix.com. This project was developed and is maintained by AI (Claude). ' +
    'Use at your own discretion.',
  shutdown: { onSignal: () => client.close() },
});
