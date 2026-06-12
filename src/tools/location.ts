import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EtixClient } from '../client.js';
import { textResult } from '../mcp.js';

/**
 * `etix_find_location`: resolve a city or postal code to coordinates.
 *
 * Backs onto Etix's consumer geolocation endpoint
 * (`POST /ticket/api/online/geolocation/search` with
 * `{ cityOrPostalCode, country }`), which returns the resolved
 * `{ latitude, longitude, city, state, postalCode }`. Useful as a
 * building block for "events near <place>" — the coordinates feed Etix's
 * own location-scoped browse.
 *
 * Read-only; rides the user's signed-in etix.com tab. Verified live
 * 2026-06-12.
 */
interface GeoResult {
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export function registerLocationTools(
  server: McpServer,
  client: EtixClient
): void {
  server.registerTool(
    'etix_find_location',
    {
      title: 'Resolve a city or postal code to coordinates',
      description:
        "Resolve a city name or postal code to coordinates (latitude/longitude) plus the normalized city/state, using Etix's geolocation lookup. Useful as a building block for location-based event browsing. Read-only, no Etix account required.",
      annotations: {
        title: 'Resolve a city or postal code to coordinates',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe('A city (optionally "City, ST") or a postal code, e.g. "Charlotte, NC" or "28202".'),
        country: z
          .string()
          .optional()
          .describe('Country code/name to scope the lookup. Defaults to "USA".'),
      },
    },
    async ({ query, country }) => {
      const geo = await client.postJson<GeoResult>(
        '/ticket/api/online/geolocation/search',
        { cityOrPostalCode: query, country: country ?? 'USA' }
      );
      return textResult({
        query,
        latitude: geo.latitude,
        longitude: geo.longitude,
        city: geo.city,
        state: geo.state,
        postal_code: geo.postalCode || undefined,
      });
    }
  );
}
