import { describe, it, expect } from 'vitest';
import { servedTools } from './served-tools.js';

/**
 * Context-group hints (`_meta.mint`, the mcp-host context-groups contract),
 * read off the SERVED `tools/list` — what a host sees — so a new tool cannot
 * skip the decision.
 *
 * Etix is public event discovery: every read needs a keyword or an id the
 * person names, and there is nothing of theirs to list (no account, no
 * children, no saved venues). So no tool can answer a group's "what's new /
 * due / on?" fan-out unprompted, and none is canonical — lookup hints only,
 * plus a non-canonical what's-on for a named venue's upcoming events.
 */
type Listed = {
  name: string;
  annotations?: { readOnlyHint?: boolean };
  inputSchema: { properties?: Record<string, unknown> };
  _meta?: { mint?: Record<string, unknown> };
};

const DOMAINS = ['school', 'home', 'work', 'family', 'health', 'money', 'travel', 'food'];
const INTENTS = ['whats-new', 'whats-due', 'whats-on', 'lookup', 'turn-on-off', 'send', 'change', 'other'];
const KEYS = ['domain', 'intent', 'canonical', 'subject', 'when', 'aliases'];
const CANONICAL_INTENTS = ['whats-new', 'whats-due', 'whats-on'];

const EXPECTED_INTENT: Record<string, string> = {
  etix_search: 'lookup',
  etix_get_event: 'lookup',
  etix_get_venue: 'whats-on',
  etix_find_location: 'lookup',
};

async function served(): Promise<Listed[]> {
  return (await servedTools()) as Listed[];
}

describe('_meta.mint on tools/list', () => {
  it('names every served tool, so a new tool cannot skip the decision', async () => {
    const names = (await served()).map((t) => t.name).filter((n) => !n.endsWith('_healthcheck'));
    expect(names.sort()).toEqual(Object.keys(EXPECTED_INTENT).sort());
  });

  it('leaves the healthcheck unhinted (registered by mcp-utils; it joins no group)', async () => {
    const hc = (await served()).find((t) => t.name === 'etix_healthcheck');
    expect(hc).toBeDefined();
    expect(hc?._meta?.mint).toBeUndefined();
  });

  it.each(Object.entries(EXPECTED_INTENT))('%s declares domain family and intent %s', async (name, intent) => {
    const mint = (await served()).find((t) => t.name === name)?._meta?.mint;
    expect(mint, name).toBeDefined();
    expect(mint!.domain).toBe('family');
    expect(mint!.intent).toBe(intent);
  });

  it('every hint is shaped per the host contract', async () => {
    for (const t of await served()) {
      if (t.name.endsWith('_healthcheck')) continue;
      const m = t._meta!.mint!;
      const props = t.inputSchema.properties ?? {};
      expect(Object.keys(m).filter((k) => !KEYS.includes(k)), t.name).toEqual([]);
      expect(DOMAINS, t.name).toContain(m.domain);
      expect(INTENTS, t.name).toContain(m.intent);
      if ('canonical' in m) expect(m.canonical, t.name).toBe(true);
      if ('subject' in m) expect(props, t.name).toHaveProperty(m.subject as string);
      if ('when' in m) {
        const when = m.when as Record<string, string>;
        expect(Object.keys(when).sort(), t.name).toEqual(['end', 'start']);
        expect(props, t.name).toHaveProperty(when.start);
        expect(props, t.name).toHaveProperty(when.end);
      }
      if ('aliases' in m) {
        const aliases = m.aliases as string[];
        expect(aliases.length, t.name).toBeLessThanOrEqual(8);
        for (const a of aliases) {
          expect(a.length, t.name).toBeLessThanOrEqual(40);
          expect(a, t.name).toBe(a.toLowerCase());
          expect(a, t.name).not.toMatch(/^etix_/);
        }
      }
    }
  });

  it('only a read-only whats-new/due/on tool may be canonical, at most one per intent', async () => {
    const canonical = (await served()).filter((t) => t._meta?.mint?.canonical === true);
    for (const t of canonical) {
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
      expect(CANONICAL_INTENTS, t.name).toContain(t._meta!.mint!.intent);
      expect(t.inputSchema.properties, t.name).toHaveProperty('view');
    }
    for (const intent of CANONICAL_INTENTS) {
      expect(canonical.filter((t) => t._meta!.mint!.intent === intent).length, intent).toBeLessThanOrEqual(1);
    }
  });

  it('marks nothing canonical: every read needs a keyword or id the person names, and nothing is listable', async () => {
    const canonical = (await served()).filter((t) => t._meta?.mint?.canonical === true).map((t) => t.name);
    expect(canonical).toEqual([]);
  });

  it('declares no subject: Etix has no listable subjects (no account, children or saved venues)', async () => {
    const withSubject = (await served()).filter((t) => t._meta?.mint && 'subject' in t._meta.mint).map((t) => t.name);
    expect(withSubject).toEqual([]);
  });

  it('carries the words a person says about tickets and shows', async () => {
    const tools = await served();
    expect(tools.find((t) => t.name === 'etix_search')?._meta?.mint?.aliases).toEqual(
      expect.arrayContaining(['tickets', 'concerts', 'shows']),
    );
    expect(tools.find((t) => t.name === 'etix_get_venue')?._meta?.mint?.aliases).toEqual(
      expect.arrayContaining(['venue', 'playing']),
    );
  });
});
