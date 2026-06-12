import { describe, it, expect, vi, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EtixClient } from '../../src/client.js';
import { registerVenueTools } from '../../src/tools/venue.js';
import { createTestHarness, parseToolResult } from '../helpers.js';

const venueHtml = readFileSync(
  fileURLToPath(new URL('../fixtures/venue.html', import.meta.url)),
  'utf8'
);

let harness: Awaited<ReturnType<typeof createTestHarness>>;
afterAll(async () => {
  if (harness) await harness.close();
});

describe('etix_get_venue', () => {
  it('fetches /ticket/v/{id} and returns venue + events', async () => {
    const fetchHtml = vi.fn().mockResolvedValue(venueHtml);
    const client = { fetchHtml } as unknown as EtixClient;
    harness = await createTestHarness((server) =>
      registerVenueTools(server, client)
    );
    const res = await harness.callTool('etix_get_venue', { venue_id: 17987 });
    const data = parseToolResult(res);
    expect(fetchHtml).toHaveBeenCalledWith('/ticket/v/17987');
    expect(data).toMatchObject({
      venue_id: 17987,
      name: 'Middle C Jazz Club',
      event_count: 2,
      organization: { id: 6831, name: 'Middle C Jazz' },
    });
    expect(data.address.city).toBe('Charlotte');
    expect(data.events[0].event_id).toBe(53827694);
  });
});
