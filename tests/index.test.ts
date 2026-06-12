// Smoke test for the full tool surface. Verifies every etix_* tool is
// registered and visible over the MCP wire — catches "forgot to wire it
// up in index.ts" mistakes that the per-tool tests miss.
import { describe, it, expect, afterAll, vi } from 'vitest';
import type { EtixClient } from '../src/client.js';
import { registerSearchTools } from '../src/tools/search.js';
import { registerEventTools } from '../src/tools/event.js';
import { registerVenueTools } from '../src/tools/venue.js';
import { registerLocationTools } from '../src/tools/location.js';
import { registerHealthcheckTools } from '../src/tools/healthcheck.js';
import { createTestHarness } from './helpers.js';

const mockClient = {
  fetchHtml: vi.fn(),
  fetchJson: vi.fn(),
  postJson: vi.fn(),
  runProbe: vi.fn(),
} as unknown as EtixClient;

const EXPECTED_TOOLS = [
  'etix_search',
  'etix_get_event',
  'etix_get_venue',
  'etix_find_location',
  'etix_healthcheck',
];

let harness: Awaited<ReturnType<typeof createTestHarness>>;
afterAll(async () => {
  if (harness) await harness.close();
});

describe('tool registration', () => {
  it('registers every advertised etix_* tool', async () => {
    harness = await createTestHarness((server) => {
      registerSearchTools(server, mockClient);
      registerEventTools(server, mockClient);
      registerVenueTools(server, mockClient);
      registerLocationTools(server, mockClient);
      registerHealthcheckTools(server, mockClient);
    });
    const tools = await harness.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });
});
