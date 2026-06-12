# Etix consumer surface — endpoint notes

What `etix-mcp` reads, and why it reads it the way it does. All shapes
below were captured live on **2026-06-12** from a signed-in etix.com tab
(via the fetchproxy bridge). Never commit captured cookies/tokens.

## Why fetchproxy (and not a direct API)

Etix has **two** APIs, and neither is a clean server-side consumer API:

1. **`api.etix.com/v3`** — a documented OpenAPI REST API (events, orders,
   customers, sell/cart, ticket validation, reports). **Every endpoint
   requires OAuth2 *password-grant* with venue/box-office client
   credentials** (only `GET /v3/timestamp` is open; even `/v3/public/*`
   returns `401 unauthorized_request`). This is a *seller* API — out of
   scope for consumer discovery.

2. **`www.etix.com/ticket/api/online/*`** — the consumer browse API used
   by etix.com itself. It is **DataDome bot-walled**: a server-side fetch
   gets a `captcha-delivery` interstitial (HTTP 202, `var dd={…}`,
   "Please enable JS and disable any ad blocker"). It only returns real
   data from an already-cleared browser session.

So every request rides the user's signed-in, DataDome-cleared etix.com
tab through the shared fetchproxy bridge (port `37149`). `classifyBotWall`
(from `@chrischall/mcp-utils/fetchproxy`) catches the interstitial via the
`captcha-delivery` marker (size-guarded < 80 KB) and the client raises a
typed `BotWallError` with a "reload your etix.com tab" hint.

## Endpoints used

### `GET /ticket/api/online/search/suggest?keywords=<kw>` → JSON

Clean JSON. Powers `etix_search`. Shape:

```jsonc
{
  "keywords": "jazz",
  "venues":     [ { "venueId": 17987, "venueName": "...", "organization": "...",
                    "address": "...", "city": "...", "state": "...", "country": "USA",
                    "venueSaleUrl": "/ticket/v/17987/middle-c-jazz-club" } ],
  "events":     [ { "eventId": 39004863, "eventName": "...", "categoryName": "Concerts",
                    "dateTime": "2027-02-05T00:30:00Z", "venueId": 4332, "venueName": "...",
                    "city": "...", "state": "...", "imageUrl": "https://cdn.etix.com/...",
                    "directSaleUrl": "/ticket/p/39004863/..." } ],
  "performers": [ { "id": 103251, "name": "Marion Meadows", "muzookaId": "mzoMB0Ym8l",
                    "imageUrl": "https://www.etix.com/ticket/api/online/search/muzooka/.../image" } ]
}
```

Note: performers use `id`/`name`/`muzookaId`/`imageUrl` — NOT
`artistId`/`artistName`. `performers` only populates on a close artist
match. The full-text `POST /ticket/api/online/search` endpoint returns an
**encrypted/opaque** payload and is deliberately unused.

### `GET /ticket/p/<eventId>` → SSR HTML

No clean event-detail JSON exists. The performance page (the bare id
resolves without the URL slug) carries:

- a `<script type="application/ld+json">` block whose `mainEntity` is a
  schema.org **Event**: `name`, `url`, `startDate`, `eventStatus`,
  `eventAttendanceMode`, `location` (Place → name, `sameAs` venue URL,
  `address`, `geo`), and `offers` (`availability` + `offers[]`, each with
  `name`/`price`/`priceCurrency`/`availability`).
- a `dataLayer = [{ … }]` analytics object (single-quoted, not JSON):
  `org_id`, `org_name`, `venue_id`, `venue_name`, `performance_id`,
  `cobrand`. Used for the numeric org id + cobrand.
- `og:image` meta (the 1200w hero image).

Powers `etix_get_event`. Prices come from the JSON-LD offers (named price
levels), so a price *range* is derived from `offers[].price`.

### `GET /ticket/v/<venueId>` → SSR HTML

Powers `etix_get_venue`. Carries:

- a header `<div id="venue-details" itemscope itemtype="http://schema.org/Place">`
  with the venue `name` (`<span itemprop="name">`, text) and a
  `PostalAddress` (street is a `<div itemprop="streetAddress">` **text**
  node; `postalCode` is a `<meta content=…>`; country is text). The header
  Place is the one schema.org/Place NOT inside a `.row.performance`.
- a list of `<div class="row performance" itemscope itemtype="http://schema.org/MusicEvent">`
  rows — each with `<meta itemprop="startDate">`, a
  `.performance-name a[href="/ticket/p/<id>/<slug>"]` (event id + name),
  `.performance-datetime` (Doors/Show text), and an
  `<etix-focal-point-image src>` thumbnail.
- the same `dataLayer` (venue identity read from `venue_id`/`venue_name`/
  `org_id`/`org_name`).

Parser selectors were diffed against the live DOM (20 rows + 1 header
Place on venue 17987), not guessed.

### `POST /ticket/api/online/geolocation/search` → JSON

Body `{ "cityOrPostalCode": "Charlotte, NC", "country": "USA" }` →
`{ latitude, longitude, city, state, postalCode, … }`. Powers
`etix_find_location`. (`keywords` is NOT a valid field — the endpoint
rejects it with a 400 naming the two known properties.)

### `GET /robots.txt` — healthcheck probe

`etix_healthcheck` round-trips this small public path through the bridge
to isolate "bridge/extension down" from "DataDome challenge on the tab".
