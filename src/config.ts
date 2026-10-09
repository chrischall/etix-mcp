// Environment-derived configuration.
import { readPortEnv } from '@chrischall/mcp-utils';

/** The whole fetchproxy fleet binds this one concentrator port; the
 *  ContextMint Bridge extension dials it. A fetchproxy MCP MUST default to
 *  it or the extension never connects. */
export const DEFAULT_PORT = 37_149;

/** The bridge port from `ETIX_WS_PORT`, via mcp-utils `readPortEnv`: unset,
 *  an unexpanded `${…}` placeholder, non-integer or out-of-range values all
 *  fall back to {@link DEFAULT_PORT} rather than becoming `NaN`. */
export function bridgePort(env: NodeJS.ProcessEnv = process.env): number {
  return readPortEnv('ETIX_WS_PORT', DEFAULT_PORT, { env });
}
