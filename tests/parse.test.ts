import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseEventDetail,
  parseVenueDetail,
  parseSuggest,
} from '../src/parse.js';

const fixture = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    'utf8'
  );

describe('parseSuggest', () => {
  const result = parseSuggest(JSON.parse(fixture('search-suggest.json')));

  it('maps venues to a stable shape', () => {
    expect(result.venues).toEqual([
      {
        venue_id: 17987,
        name: 'Middle C Jazz Club',
        organization: 'Middle C Jazz',
        address: '300 South Brevard Street',
        city: 'Charlotte',
        state: 'NC',
        country: 'USA',
        url: 'https://www.etix.com/ticket/v/17987/middle-c-jazz-club',
      },
    ]);
  });

  it('maps events to a stable shape', () => {
    expect(result.events[0]).toMatchObject({
      event_id: 39004863,
      name: 'North Carolina Jazz Festival - Thursday Night',
      category: 'Concerts',
      date_time: '2027-02-05T00:30:00Z',
      venue_id: 4332,
      venue_name: 'North Carolina Jazz Festival - Hotel Ballast Wilmington',
      city: 'Wilmington',
      state: 'NC',
      url: 'https://www.etix.com/ticket/p/39004863/north-carolina-jazz-festival-thursday-night-wilmington-north-carolina-jazz-festival-hotel-ballast-wilmington',
    });
  });

  it('maps performers (id/name/muzookaId/imageUrl) to a stable shape', () => {
    expect(result.performers).toEqual([
      {
        performer_id: 103251,
        name: 'Marion Meadows',
        image_url:
          'https://www.etix.com/ticket/api/online/search/muzooka/mzoMB0Ym8l/image',
      },
    ]);
  });

  it('handles a payload missing arrays without throwing', () => {
    const empty = parseSuggest({ keywords: 'zzz' });
    expect(empty).toEqual({ venues: [], events: [], performers: [] });
  });
});

describe('parseEventDetail', () => {
  const ev = parseEventDetail(fixture('event.html'), 39004863);

  it('extracts identity + schedule from JSON-LD', () => {
    expect(ev).toMatchObject({
      event_id: 39004863,
      name: 'North Carolina Jazz Festival - Thursday Night',
      url: 'https://www.etix.com/ticket/p/39004863/north-carolina-jazz-festival-thursday-night-wilmington-north-carolina-jazz-festival-hotel-ballast-wilmington',
      start_date: '2027-02-04T19:30:00.000-05:00',
      status: 'https://schema.org/EventScheduled',
      image_url:
        'https://cdn.etix.com/etix/performance-image/performance_image_1200w/0a633e9430006eefbc2f8753193f9430.jpg',
    });
  });

  it('extracts the venue with address + geo', () => {
    expect(ev.venue).toEqual({
      name: 'North Carolina Jazz Festival - Hotel Ballast Wilmington',
      venue_id: 4332,
      url: 'https://www.etix.com/ticket/v/4332/north-carolina-jazz-festival-hotel-ballast-wilmington',
      street: 'Po Box 7681',
      city: 'Wilmington',
      state: 'NC',
      postal_code: '28401-3934',
      country: 'United States',
      latitude: 34.238827,
      longitude: -77.950806,
    });
  });

  it('extracts the organization + cobrand from the dataLayer', () => {
    expect(ev.organization).toEqual({ id: 1744, name: 'North Carolina Jazz Festival' });
    expect(ev.cobrand).toBe('ncjazz');
  });

  it('extracts the priced offers and a price range', () => {
    expect(ev.offers).toEqual([
      { name: 'INDIVIDUAL PRICE LEVEL 1', price: 65, currency: 'USD', availability: 'http://schema.org/InStock' },
      { name: 'Active Military PRICE LEVEL 1', price: 25, currency: 'USD', availability: 'http://schema.org/InStock' },
      { name: 'STUDENT PRICE LEVEL 1', price: 15, currency: 'USD', availability: 'http://schema.org/InStock' },
    ]);
    expect(ev.price).toEqual({ currency: 'USD', min: 15, max: 65 });
    expect(ev.availability).toBe('http://schema.org/InStock');
  });

  it('throws a helpful error when no JSON-LD event block is present', () => {
    expect(() => parseEventDetail('<html><body>nope</body></html>', 1)).toThrow(
      /could not parse/i
    );
  });
});

describe('parseVenueDetail', () => {
  const venue = parseVenueDetail(fixture('venue.html'), 17987);

  it('extracts venue identity from the dataLayer', () => {
    expect(venue).toMatchObject({
      venue_id: 17987,
      name: 'Middle C Jazz Club',
      organization: { id: 6831, name: 'Middle C Jazz' },
    });
  });

  it('extracts the venue address from header microdata', () => {
    expect(venue.address).toEqual({
      street: '300 South Brevard Street',
      city: 'Charlotte',
      state: 'NC',
      postal_code: '28202-2350',
      country: 'United States',
    });
  });

  it('lists upcoming events from the performance rows', () => {
    expect(venue.events).toHaveLength(2);
    expect(venue.events[0]).toEqual({
      event_id: 53827694,
      name: 'Bob Baldwin, International Contemporary Jazz Pianist',
      url: 'https://www.etix.com/ticket/p/53827694/bob-baldwininternational-contemporary-jazz-pianist-charlotte-middle-c-jazz-club',
      start_date: '2026-06-12T18:00:00-0400',
      datetime_text: 'Doors at 5:15 PM, Show at 6:00 PM',
      image_url:
        'https://cdn.etix.com/etix/performance-image/performance_image_150w/aeec940aee8dcb306d54d1f68672c994.jpg',
    });
    expect(venue.events[1].event_id).toBe(89953739);
  });

  it('returns an empty events list (not a throw) for a venue with no rows', () => {
    const bare = parseVenueDetail(
      '<html><body><script>dataLayer = [{ \'venue_id\' : \'1\', \'venue_name\' : \'X\', \'org_id\' : \'2\', \'org_name\' : \'Y\' }]</script></body></html>',
      1
    );
    expect(bare.events).toEqual([]);
    expect(bare.name).toBe('X');
  });
});
