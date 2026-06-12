import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EtixClient } from '../client.js';
import { textResult } from '../mcp.js';
import { parseEventDetail } from '../parse.js';

/**
 * `etix_get_event`: full detail for one Etix event/performance by id.
 *
 * Etix has no clean event-detail JSON endpoint — the performance page is
 * server-rendered HTML — but it carries a schema.org JSON-LD `Event`
 * block (name, schedule, location with address + geo, priced offers)
 * plus a `dataLayer` analytics object (org id/name, cobrand). The id
 * alone is enough: `/ticket/p/{id}` resolves without the URL slug.
 *
 * Read-only; rides the user's signed-in etix.com tab. Verified live
 * 2026-06-12 against performance 39004863.
 */
export function registerEventTools(server: McpServer, client: EtixClient): void {
  server.registerTool(
    'etix_get_event',
    {
      title: 'Get an Etix event/performance by id',
      description:
        "Fetch a single Etix event (performance) by its numeric event_id — name, date/time, venue (with address + coordinates), organizer, ticket price range and the individual priced offer levels. Get the event_id from etix_search. Read-only, no Etix account required.",
      annotations: {
        title: 'Get an Etix event/performance by id',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        event_id: z
          .number()
          .int()
          .positive()
          .describe('Etix event/performance id (e.g. 39004863). From etix_search.'),
      },
    },
    async ({ event_id }) => {
      const html = await client.fetchHtml(`/ticket/p/${event_id}`);
      return textResult(parseEventDetail(html, event_id));
    }
  );
}
