// The full served tool surface, registered against a stub client, for tests
// that assert on what `tools/list` actually publishes.
import { vi } from 'vitest';
import type { EtixClient } from '../src/client.js';
import { registerSearchTools } from '../src/tools/search.js';
import { registerEventTools } from '../src/tools/event.js';
import { registerVenueTools } from '../src/tools/venue.js';
import { registerLocationTools } from '../src/tools/location.js';
import { registerHealthcheckTools } from '../src/tools/healthcheck.js';
import { createTestHarness } from './helpers.js';

export async function servedTools() {
  const client = {
    fetchHtml: vi.fn(),
    fetchJson: vi.fn(),
    postJson: vi.fn(),
    runProbe: vi.fn(),
  } as unknown as EtixClient;
  const h = await createTestHarness((server) => {
    registerSearchTools(server, client);
    registerEventTools(server, client);
    registerVenueTools(server, client);
    registerLocationTools(server, client);
    registerHealthcheckTools(server, client);
  });
  try {
    return (await h.client.listTools()).tools;
  } finally {
    await h.close();
  }
}
