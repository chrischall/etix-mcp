import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { EtixClient } from '../client.js';
import { minifiedResult } from '../mcp.js';

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

type ResolvedGeo = GeoResult & { latitude: number; longitude: number };

function asGeoResult(body: unknown): ResolvedGeo | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  const geo = body as GeoResult;
  return Number.isFinite(geo.latitude) && Number.isFinite(geo.longitude)
    ? (geo as ResolvedGeo)
    : undefined;
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
        "Resolve a city name or postal code to coordinates (latitude/longitude) plus the normalized city/state, using Etix's geolocation lookup. Useful as a building block for location-based event browsing. Returns found:false with a message when nothing matches. Read-only, no Etix account required.",
      annotations: {
        title: 'Resolve a city or postal code to coordinates',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe('A city (optionally "City, ST") or a postal code, e.g. "Charlotte, NC" or "28202".'),
        country: z
          .string()
          .optional()
          .describe('Country code/name to scope the lookup. Defaults to "USA".'),
      }),
    },
    async ({ query, country }) => {
      const body = await client.postJson<unknown>(
        '/ticket/api/online/geolocation/search',
        { cityOrPostalCode: query, country: country ?? 'USA' },
        // A read-only lookup that happens to use POST — safe to re-send
        // after a bridge timeout (fetchproxy 3.2 won't retry POSTs unasked).
        { retryOnTimeout: true }
      );
      // An unresolvable city can come back as `null`, a non-object, or an
      // object without coordinates. Say "no match" explicitly rather than
      // throwing a TypeError or returning a coordinate-less result
      // (fleet-audit#427).
      const geo = asGeoResult(body);
      if (!geo) {
        return minifiedResult({
          query,
          found: false,
          message: `No location matched "${query}". Try a different spelling, add the state ("City, ST"), or use a postal code.`,
        });
      }
      return minifiedResult({
        query,
        found: true,
        latitude: geo.latitude,
        longitude: geo.longitude,
        city: geo.city,
        state: geo.state,
        postal_code: geo.postalCode || undefined,
      });
    }
  );
}
