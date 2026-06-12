# etix-mcp

Etix event discovery as an MCP server for Claude — search events, venues, and performers and pull full event/venue details via natural language.

> ⚠️ Etix does not publish a public consumer API, and its consumer site sits behind a DataDome bot-wall. This server reads the same `/ticket/api/online/...` endpoints and server-rendered pages that etix.com itself uses, routed through your own signed-in browser tab via the [fetchproxy](https://github.com/chrischall/fetchproxy) extension. Every request acts on behalf of your existing session — your cookies, your TLS, your JS context — exactly as if you'd browsed it yourself. No Etix account is required; this is public discovery data. Use at your own discretion.

## Tools

| Tool | Purpose |
| --- | --- |
| `etix_search` | Search events, venues, and performers by keyword. Returns a few top matches per category, each with its id and canonical etix.com URL. |
| `etix_get_event` | Full record for an event/performance by `event_id` — name, date/time, venue (with address + coordinates), organizer, ticket price range and the individual priced offer levels. |
| `etix_get_venue` | A venue by `venue_id` — name, organizer, full address, and the list of upcoming events at that venue. |
| `etix_find_location` | Resolve a city name or postal code to coordinates plus normalized city/state — a building block for location-based event browsing. |
| `etix_healthcheck` | End-to-end bridge check — round-trips `/robots.txt` and reports which hop failed (bridge down vs. extension not connected vs. DataDome challenge on your tab). Call when other tools fail. |

## How it works

Etix fronts its consumer site with a DataDome interstitial that a server-side fetch can't clear, so `etix-mcp` routes every request through your signed-in, already-cleared etix.com tab via the shared fetchproxy bridge (WebSocket on `127.0.0.1:37149`). `etix_search` reads the clean `search/suggest` JSON endpoint; `etix_get_event` and `etix_get_venue` parse the server-rendered performance/venue pages (schema.org JSON-LD + microdata). See [`docs/ETIX-API.md`](docs/ETIX-API.md) for the verified endpoint shapes.

## Setup

See [SKILL.md](SKILL.md) for full install steps: add the server to your MCP config, install the shared fetchproxy extension, open etix.com, and approve the one-time pairing. Then run `etix_healthcheck`.

## Development

```bash
npm ci
npm run build   # tsc --noEmit + esbuild bundle → dist/bundle.js
npm test        # vitest
```

## Acknowledgement of Terms

By using this MCP server, you acknowledge that it uses your own etix.com session via the fetchproxy extension, that Etix offers no public consumer API (so the underlying endpoints may change at any time), and that this is an unofficial, AI-developed project with no affiliation to Etix. Use at your own discretion, consistent with Etix's Terms of Use.

## License

MIT — developed and maintained by AI (Claude Code).
