import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EtixClient } from '../client.js';
import { textResult } from '../mcp.js';
import { parseSuggest } from '../parse.js';

/**
 * `etix_search`: keyword search across Etix events, venues, and
 * performers.
 *
 * Backs onto the consumer suggest endpoint
 * (`GET /ticket/api/online/search/suggest?keywords=…`), which returns a
 * clean JSON payload of matching venues, events (performances), and
 * performers. Each result carries the id and the canonical sale URL, so
 * a caller can follow up with `etix_get_event` / `etix_get_venue`.
 *
 * Read-only. Auth is the user's signed-in etix.com tab (the request
 * rides the fetchproxy bridge), but no Etix account is required — this
 * is public discovery data. Verified live 2026-06-12.
 */
export function registerSearchTools(server: McpServer, client: EtixClient): void {
  server.registerTool(
    'etix_search',
    {
      title: 'Search Etix events, venues, and performers',
      description:
        "Search Etix by keyword and get matching events (performances), venues, and performers — each with its id and canonical etix.com URL. Follow up with etix_get_event (event_id) or etix_get_venue (venue_id) for full details. Backs onto Etix's public suggest endpoint; returns a few top matches per category, not an exhaustive list. Read-only, no Etix account required.",
      annotations: {
        title: 'Search Etix events, venues, and performers',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        keywords: z
          .string()
          .min(1)
          .describe('Search text — an artist, event, or venue name (e.g. "jazz", "Marion Meadows").'),
      },
    },
    async ({ keywords }) => {
      const raw = await client.fetchJson<Record<string, never>>(
        `/ticket/api/online/search/suggest?keywords=${encodeURIComponent(keywords)}`
      );
      const result = parseSuggest(raw);
      return textResult({
        keywords,
        venue_count: result.venues.length,
        event_count: result.events.length,
        performer_count: result.performers.length,
        ...result,
      });
    }
  );
}
