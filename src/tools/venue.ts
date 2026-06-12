import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EtixClient } from '../client.js';
import { textResult } from '../mcp.js';
import { parseVenueDetail } from '../parse.js';

/**
 * `etix_get_venue`: a venue's profile plus its upcoming events by id.
 *
 * The venue page (`/ticket/v/{id}`) is server-rendered HTML: a header
 * schema.org `Place` (name + address microdata) and a list of
 * `.row.performance` MusicEvent rows (each an event id, name, start, and
 * image). Venue identity (id, name, organizer) is read from the page's
 * `dataLayer` analytics object.
 *
 * Read-only; rides the user's signed-in etix.com tab. Verified live
 * 2026-06-12 against venue 17987 (Middle C Jazz Club).
 */
export function registerVenueTools(server: McpServer, client: EtixClient): void {
  server.registerTool(
    'etix_get_venue',
    {
      title: 'Get an Etix venue and its upcoming events by id',
      description:
        "Fetch a single Etix venue by its numeric venue_id — name, organizer, full address, and the list of upcoming events at that venue (each with event_id, name, start time, and ticket URL). Get the venue_id from etix_search. Follow up with etix_get_event for any listed event. Read-only, no Etix account required.",
      annotations: {
        title: 'Get an Etix venue and its upcoming events by id',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        venue_id: z
          .number()
          .int()
          .positive()
          .describe('Etix venue id (e.g. 17987). From etix_search.'),
      },
    },
    async ({ venue_id }) => {
      const html = await client.fetchHtml(`/ticket/v/${venue_id}`);
      const venue = parseVenueDetail(html, venue_id);
      return textResult({ ...venue, event_count: venue.events.length });
    }
  );
}
