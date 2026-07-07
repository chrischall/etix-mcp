// Parsers for Etix's consumer surface.
//
// Etix exposes three usable shapes for discovery:
//   1. search/suggest  — a clean JSON endpoint (venues / events / performers).
//   2. performance page — SSR HTML carrying a schema.org JSON-LD `Event`
//      block, a `dataLayer` analytics object (org/venue/performance ids +
//      names + cobrand), and `og:` meta. The JSON-LD is the rich, clean
//      parse target; the dataLayer fills in the numeric org id + cobrand.
//   3. venue page      — SSR HTML with a header schema.org `Place`
//      (address microdata) plus a list of `.row.performance` MusicEvent
//      rows (each an event id + name + start + image).
//
// Verified live 2026-06-12 against venue 17987 (Middle C Jazz Club) and
// performance 39004863 (NC Jazz Festival). Selectors and field names were
// diffed against the real bytes, not guessed — see docs/ETIX-API.md.

import { parse, type HTMLElement } from 'node-html-parser';
import { findJsonLdEntity, ogContent } from '@chrischall/mcp-utils';

const BASE = 'https://www.etix.com';

function abs(pathOrUrl: string | undefined): string | undefined {
  if (!pathOrUrl) return undefined;
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE}${pathOrUrl}`;
}

function idFromPath(url: string | undefined, segment: 'p' | 'v'): number | undefined {
  if (!url) return undefined;
  const m = url.match(new RegExp(`/ticket/${segment}/(\\d+)`));
  return m ? Number(m[1]) : undefined;
}

function num(s: string | undefined): number | undefined {
  if (s === undefined || s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// ─── search/suggest ────────────────────────────────────────────────────────

export interface SuggestVenue {
  venue_id?: number;
  name?: string;
  organization?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  url?: string;
}

export interface SuggestEvent {
  event_id?: number;
  name?: string;
  category?: string;
  date_time?: string;
  venue_id?: number;
  venue_name?: string;
  city?: string;
  state?: string;
  image_url?: string;
  url?: string;
}

export interface SuggestPerformer {
  performer_id?: number;
  name?: string;
  image_url?: string;
}

export interface SuggestResult {
  venues: SuggestVenue[];
  events: SuggestEvent[];
  performers: SuggestPerformer[];
}

interface RawSuggest {
  venues?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  performers?: Array<Record<string, unknown>>;
}

export function parseSuggest(raw: RawSuggest): SuggestResult {
  const venues = (raw.venues ?? []).map((v) => ({
    venue_id: v.venueId as number | undefined,
    name: v.venueName as string | undefined,
    organization: v.organization as string | undefined,
    address: v.address as string | undefined,
    city: v.city as string | undefined,
    state: v.state as string | undefined,
    country: v.country as string | undefined,
    url: abs(v.venueSaleUrl as string | undefined),
  }));
  const events = (raw.events ?? []).map((e) => ({
    event_id: e.eventId as number | undefined,
    name: e.eventName as string | undefined,
    category: e.categoryName as string | undefined,
    date_time: e.dateTime as string | undefined,
    venue_id: e.venueId as number | undefined,
    venue_name: e.venueName as string | undefined,
    city: e.city as string | undefined,
    state: e.state as string | undefined,
    image_url: e.imageUrl as string | undefined,
    url: abs((e.directSaleUrl as string | undefined) ?? undefined),
  }));
  const performers = (raw.performers ?? []).map((p) => ({
    performer_id: p.id as number | undefined,
    name: p.name as string | undefined,
    image_url: p.imageUrl as string | undefined,
  }));
  return { venues, events, performers };
}

// ─── shared HTML helpers ────────────────────────────────────────────────────

/** Parse the page-level `dataLayer = [{ 'k' : 'v', ... }]` analytics object.
 *  It's single-quoted (not valid JSON), so we scrape the `'key' : 'value'`
 *  pairs directly. Returns a flat string map. */
export function extractDataLayer(html: string): Record<string, string> {
  const block = html.match(/dataLayer\s*=\s*\[\s*\{([\s\S]*?)\}\s*\]/);
  const out: Record<string, string> = {};
  if (!block) return out;
  for (const m of block[1].matchAll(/'([\w]+)'\s*:\s*'([^']*)'/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

// ─── performance / event detail ─────────────────────────────────────────────

export interface EventVenue {
  name?: string;
  venue_id?: number;
  url?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface EventOffer {
  name?: string;
  price?: number;
  currency?: string;
  availability?: string;
}

export interface EventDetail {
  event_id: number;
  name?: string;
  url?: string;
  description?: string;
  start_date?: string;
  status?: string;
  attendance_mode?: string;
  image_url?: string;
  venue: EventVenue;
  organization?: { id?: number; name?: string };
  cobrand?: string;
  availability?: string;
  offers: EventOffer[];
  price?: { currency?: string; min?: number; max?: number };
}

export function parseEventDetail(html: string, eventId: number): EventDetail {
  // The schema.org Event hides inside a `WebPage.mainEntity`; the shared
  // `findJsonLdEntity` walks blocks, `@graph`, and `mainEntity` for the
  // `@type === 'Event'` node (consolidates etix's local `extractEventJsonLd`).
  const main = findJsonLdEntity(html, 'Event');
  if (!main) {
    throw new Error(
      `Etix event ${eventId}: could not parse the event page — no schema.org JSON-LD ` +
        `Event block was found. The page may have been a bot-wall interstitial, a 404, ` +
        `or a layout Etix changed.`
    );
  }
  const dl = extractDataLayer(html);

  const loc = (main.location ?? {}) as Record<string, unknown>;
  const addr = (loc.address ?? {}) as Record<string, unknown>;
  const geo = (loc.geo ?? {}) as Record<string, unknown>;
  const sameAs = Array.isArray(loc.sameAs)
    ? (loc.sameAs[0] as string | undefined)
    : undefined;

  const offersWrap = (main.offers ?? {}) as Record<string, unknown>;
  const rawOffers = Array.isArray(offersWrap.offers)
    ? (offersWrap.offers as Array<Record<string, unknown>>)
    : [];
  const offers: EventOffer[] = rawOffers.map((o) => ({
    name: o.name as string | undefined,
    price: o.price as number | undefined,
    currency: o.priceCurrency as string | undefined,
    availability: o.availability as string | undefined,
  }));
  const prices = offers
    .map((o) => o.price)
    .filter((p): p is number => typeof p === 'number');
  const price =
    prices.length > 0
      ? {
          currency: offers.find((o) => o.currency)?.currency,
          min: Math.min(...prices),
          max: Math.max(...prices),
        }
      : undefined;

  const orgId = num(dl.org_id);
  const orgName = dl.org_name || undefined;

  return {
    event_id: eventId,
    name: main.name as string | undefined,
    url: main.url as string | undefined,
    description: (main.description as string | undefined) || undefined,
    start_date: main.startDate as string | undefined,
    status: main.eventStatus as string | undefined,
    attendance_mode: main.eventAttendanceMode as string | undefined,
    image_url: ogContent(html, 'og:image'),
    venue: {
      name: loc.name as string | undefined,
      venue_id: idFromPath(sameAs, 'v'),
      url: sameAs,
      street: (addr.streetAddress as string | undefined)?.trim(),
      city: addr.addressLocality as string | undefined,
      state: addr.addressRegion as string | undefined,
      postal_code: addr.postalCode as string | undefined,
      country: addr.addressCountry as string | undefined,
      latitude: geo.latitude as number | undefined,
      longitude: geo.longitude as number | undefined,
    },
    ...(orgId !== undefined || orgName
      ? { organization: { id: orgId, name: orgName } }
      : {}),
    ...(dl.cobrand ? { cobrand: dl.cobrand } : {}),
    availability: offersWrap.availability as string | undefined,
    offers,
    ...(price ? { price } : {}),
  };
}

// ─── venue detail ───────────────────────────────────────────────────────────

export interface VenueAddress {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface VenueEvent {
  event_id?: number;
  name?: string;
  url?: string;
  start_date?: string;
  datetime_text?: string;
  image_url?: string;
}

export interface VenueDetail {
  venue_id: number;
  name?: string;
  organization?: { id?: number; name?: string };
  address?: VenueAddress;
  image_url?: string;
  events: VenueEvent[];
}

function microdataText(el: HTMLElement, itemprop: string): string | undefined {
  const node = el.querySelector(`[itemprop="${itemprop}"]`);
  if (!node) return undefined;
  const content = node.getAttribute('content');
  const text = (content ?? node.text)?.trim();
  return text || undefined;
}

function parseMicrodataAddress(place: HTMLElement): VenueAddress {
  return {
    street: microdataText(place, 'streetAddress'),
    city: microdataText(place, 'addressLocality'),
    state: microdataText(place, 'addressRegion'),
    postal_code: microdataText(place, 'postalCode'),
    // addressCountry carries content="US" but the human-readable text
    // ("United States") is what we surface.
    country: place
      .querySelector('[itemprop="addressCountry"]')
      ?.text?.trim() || undefined,
  };
}

export function parseVenueDetail(html: string, venueId: number): VenueDetail {
  const root = parse(html);
  const dl = extractDataLayer(html);

  // The venue's own Place is the first schema.org/Place that is NOT one of
  // the per-row `.performance-location` blocks.
  const places = root.querySelectorAll('[itemtype$="/Place"]');
  const headerPlace = places.find((p) => !p.closest('.row.performance'));

  const orgId = num(dl.org_id);
  const orgName = dl.org_name || undefined;

  const rows = root.querySelectorAll('.row.performance');
  const events: VenueEvent[] = rows.map((row) => {
    const link = row.querySelector('.performance-name a');
    const href = link?.getAttribute('href');
    return {
      event_id: idFromPath(href, 'p'),
      name: link?.text?.trim() || undefined,
      url: abs(href?.split('?')[0]),
      start_date:
        row.querySelector('meta[itemprop="startDate"]')?.getAttribute('content') ||
        undefined,
      datetime_text:
        row.querySelector('.performance-datetime')?.text?.trim() || undefined,
      image_url:
        row.querySelector('etix-focal-point-image')?.getAttribute('src') ||
        undefined,
    };
  });

  const name =
    dl.venue_name ||
    (headerPlace ? microdataText(headerPlace, 'name') : undefined);

  return {
    venue_id: venueId,
    name,
    ...(orgId !== undefined || orgName
      ? { organization: { id: orgId, name: orgName } }
      : {}),
    ...(headerPlace ? { address: parseMicrodataAddress(headerPlace) } : {}),
    image_url: ogContent(html, 'og:image'),
    events,
  };
}
