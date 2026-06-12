import { describe, it, expect, vi, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EtixClient } from '../../src/client.js';
import { registerSearchTools } from '../../src/tools/search.js';
import { createTestHarness, parseToolResult } from '../helpers.js';

const suggest = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../fixtures/search-suggest.json', import.meta.url)),
    'utf8'
  )
);

let harness: Awaited<ReturnType<typeof createTestHarness>>;
afterAll(async () => {
  if (harness) await harness.close();
});

describe('etix_search', () => {
  it('searches and returns counts + parsed results', async () => {
    const fetchJson = vi.fn().mockResolvedValue(suggest);
    const client = { fetchJson } as unknown as EtixClient;
    harness = await createTestHarness((server) =>
      registerSearchTools(server, client)
    );
    const res = await harness.callTool('etix_search', { keywords: 'jazz' });
    const data = parseToolResult(res);
    expect(fetchJson).toHaveBeenCalledWith(
      '/ticket/api/online/search/suggest?keywords=jazz'
    );
    expect(data).toMatchObject({
      keywords: 'jazz',
      venue_count: 1,
      event_count: 1,
      performer_count: 1,
    });
    expect(data.venues[0].venue_id).toBe(17987);
    expect(data.events[0].event_id).toBe(39004863);
    expect(data.performers[0].performer_id).toBe(103251);
  });

  it('url-encodes the keywords', async () => {
    const fetchJson = vi
      .fn()
      .mockResolvedValue({ keywords: 'a b', venues: [], events: [], performers: [] });
    const client = { fetchJson } as unknown as EtixClient;
    const h = await createTestHarness((server) =>
      registerSearchTools(server, client)
    );
    await h.callTool('etix_search', { keywords: 'Marion Meadows' });
    expect(fetchJson).toHaveBeenCalledWith(
      '/ticket/api/online/search/suggest?keywords=Marion%20Meadows'
    );
    await h.close();
  });
});
