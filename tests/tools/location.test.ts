import { describe, it, expect, vi, afterAll } from 'vitest';
import type { EtixClient } from '../../src/client.js';
import { registerLocationTools } from '../../src/tools/location.js';
import { createTestHarness, parseToolResult } from '../helpers.js';

let harness: Awaited<ReturnType<typeof createTestHarness>>;
afterAll(async () => {
  if (harness) await harness.close();
});

describe('etix_find_location', () => {
  it('POSTs cityOrPostalCode + country and returns coordinates', async () => {
    const postJson = vi.fn().mockResolvedValue({
      latitude: 35.2270768,
      longitude: -80.8408933,
      city: 'Charlotte',
      state: 'NC',
      postalCode: '',
    });
    const client = { postJson } as unknown as EtixClient;
    harness = await createTestHarness((server) =>
      registerLocationTools(server, client)
    );
    const res = await harness.callTool('etix_find_location', {
      query: 'Charlotte, NC',
    });
    const data = parseToolResult(res);
    expect(postJson).toHaveBeenCalledWith(
      '/ticket/api/online/geolocation/search',
      { cityOrPostalCode: 'Charlotte, NC', country: 'USA' }
    );
    expect(data).toMatchObject({
      query: 'Charlotte, NC',
      latitude: 35.2270768,
      city: 'Charlotte',
      state: 'NC',
    });
    // empty postalCode collapses to undefined (omitted from JSON)
    expect('postal_code' in data).toBe(false);
  });

  it('passes a custom country through', async () => {
    const postJson = vi.fn().mockResolvedValue({ city: 'Toronto' });
    const client = { postJson } as unknown as EtixClient;
    const h = await createTestHarness((server) =>
      registerLocationTools(server, client)
    );
    await h.callTool('etix_find_location', { query: 'Toronto', country: 'CAN' });
    expect(postJson).toHaveBeenCalledWith(
      '/ticket/api/online/geolocation/search',
      { cityOrPostalCode: 'Toronto', country: 'CAN' }
    );
    await h.close();
  });
});
