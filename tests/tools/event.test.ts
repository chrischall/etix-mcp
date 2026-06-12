import { describe, it, expect, vi, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EtixClient } from '../../src/client.js';
import { registerEventTools } from '../../src/tools/event.js';
import { createTestHarness, parseToolResult } from '../helpers.js';

const eventHtml = readFileSync(
  fileURLToPath(new URL('../fixtures/event.html', import.meta.url)),
  'utf8'
);

let harness: Awaited<ReturnType<typeof createTestHarness>>;
afterAll(async () => {
  if (harness) await harness.close();
});

describe('etix_get_event', () => {
  it('fetches /ticket/p/{id} and returns parsed event detail', async () => {
    const fetchHtml = vi.fn().mockResolvedValue(eventHtml);
    const client = { fetchHtml } as unknown as EtixClient;
    harness = await createTestHarness((server) =>
      registerEventTools(server, client)
    );
    const res = await harness.callTool('etix_get_event', { event_id: 39004863 });
    const data = parseToolResult(res);
    expect(fetchHtml).toHaveBeenCalledWith('/ticket/p/39004863');
    expect(data).toMatchObject({
      event_id: 39004863,
      name: 'North Carolina Jazz Festival - Thursday Night',
      price: { currency: 'USD', min: 15, max: 65 },
    });
    expect(data.venue.venue_id).toBe(4332);
    expect(data.organization).toEqual({ id: 1744, name: 'North Carolina Jazz Festival' });
  });

  it('rejects a non-positive event_id at the schema boundary', async () => {
    const client = { fetchHtml: vi.fn() } as unknown as EtixClient;
    const h = await createTestHarness((server) =>
      registerEventTools(server, client)
    );
    const res = await h.callTool('etix_get_event', { event_id: -1 });
    expect(res.isError).toBe(true);
    await h.close();
  });
});
