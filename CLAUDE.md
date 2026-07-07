# CLAUDE.md — etix-mcp

Guidance for Claude working in this repo.

## TL;DR

Etix consumer event-discovery MCP. Default and only transport: localhost WebSocket via [`@fetchproxy/server`](https://github.com/chrischall/fetchproxy) — the companion browser extension is installed separately, not embedded. Every HTTP call to etix.com is dispatched through the user's signed-in browser tab, so it rides their existing, DataDome-cleared session. No Etix account is required (public discovery data).

This is a "Pattern A" fetchproxy MCP (every call rides through fetchproxy), not "Pattern B" (one bootstrap call then direct fetch). Etix's DataDome wall challenges any server-side fetch, so in-session routing has to be per-call.

## Why fetchproxy (not a direct API)

Etix has two APIs, neither a clean server-side consumer API:

- **`api.etix.com/v3`** — documented OpenAPI REST API, but **OAuth2 password-grant with venue/box-office credentials** on every endpoint (a *seller* API). Out of scope.
- **`www.etix.com/ticket/api/online/*`** — the consumer browse API, **DataDome bot-walled** server-side. Only returns data from an already-cleared browser session.

Full endpoint notes + verified shapes: [`docs/ETIX-API.md`](docs/ETIX-API.md).

## Tool surface

| Tool | File | Endpoint(s) | Kind |
| --- | --- | --- | --- |
| `etix_search` | `tools/search.ts` | `GET /ticket/api/online/search/suggest?keywords=…` → JSON (venues/events/performers) | read |
| `etix_get_event` | `tools/event.ts` | `GET /ticket/p/<id>` SSR HTML → schema.org JSON-LD Event + dataLayer + og:image | read |
| `etix_get_venue` | `tools/venue.ts` | `GET /ticket/v/<id>` SSR HTML → header Place microdata + `.row.performance` MusicEvent rows + dataLayer | read |
| `etix_find_location` | `tools/location.ts` | `POST /ticket/api/online/geolocation/search` `{cityOrPostalCode, country}` → coords | read |
| `etix_healthcheck` | `tools/healthcheck.ts` | `GET /robots.txt` round-trip through fetchproxy + bridge status | read |

All tools are **read-only** — there are no write/mutating tools (buying tickets is a financial action and out of scope), so none are `confirm`-gated.

## Architecture

```
src/
  index.ts              # entry — builds FetchproxyTransport, EtixClient,
                        #   registers tool groups, connects stdio transport
  version.ts            # single VERSION source (x-release-please-version marker)
  transport.ts          # EtixTransport interface
  transport-fetchproxy.ts # thin class over @chrischall/mcp-utils/fetchproxy's
                        #   createFetchproxyTransport verb adapter; ETIX_DEBUG timing
  client.ts             # EtixClient.fetchHtml / fetchJson / postJson
                        #   + DataDome bot-wall detection (classifyBotWall → BotWallError)
  parse.ts              # parseSuggest / parseEventDetail / parseVenueDetail
                        #   (JSON-LD + dataLayer + schema.org microdata)
  mcp.ts                # textResult re-export
  tools/*.ts            # one registerXxxTools per tool
```

- **Shared port `37149`.** The whole fetchproxy fleet binds the same concentrator port; the Transporter extension dials it. Override via `ETIX_WS_PORT`.
- **Bot-wall handling.** `classifyBotWall` catches the DataDome interstitial (`captcha-delivery` marker, size-guarded). The client raises a typed `BotWallError` with a "reload your etix.com tab" hint instead of feeding a captcha page to a parser.
- **Parsers verified against real bytes.** Selectors + JSON-LD/dataLayer field names were diffed against the live DOM (venue 17987, performance 39004863), not guessed. Fixtures under `tests/fixtures/` mirror the real structure (secrets stripped).

## Conventions

- **TDD.** Failing test → minimal code → green. `npm test` (vitest) must stay green.
- **Results** via `textResult(data)`; errors via typed `Error` subclasses (`BotWallError`) with actionable hints.
- **Version** lives only in `src/version.ts`; release-please bumps it (+ the manifests listed in `release-please-config.json` `extra-files`). `tests/version-sync.test.ts` guards drift. Don't hand-bump.
- **Server-boot smoke test** (`tests/server-boot.test.ts`) spawns the real `dist/bundle.js` with no `node_modules` and asserts the initialize + tools/list handshake — catches eager-import crashes the unit tests can't.
- **Don't merge PRs or add `ready-to-merge` yourself** — `pr-auto-review` + `auto-merge` ship it on a `pass` or `warn` verdict; `fail` blocks.

## Setup / publishing

See [SKILL.md](SKILL.md). Public npm package `etix-mcp` (provenance publish), MCP registry `io.github.chrischall/etix-mcp`, `.mcpb` bundle + ClawHub skill on release.

<!-- pr-workflow:v2 -->
## Pull requests & releases

**Default workflow: branch + PR.** This repo **squash-merges**, so the **PR title MUST be a Conventional Commit** (`fix(scope): …`, `feat(scope): …`) — it becomes the squash commit's subject line, the only thing release-please (`.github/workflows/release-please.yml`) parses to pick the version bump and changelog section. Only `feat` (minor), `fix` (patch), and `!`/`BREAKING CHANGE` (major) cut a release; `perf`/`refactor`/`docs` show in the changelog without bumping; `ci`/`test`/`build`/`chore` are recognised but hidden (`release-please-config.json` → `changelog-sections`). A title without a conventional type is invisible to release-please.

**Exception for first-party dependency bumps.** When bumping a package we own (`@chrischall/mcp-utils`, `@chrischall/realty-core`, `@fetchproxy/server` — anything published from a chrischall-owned repo), label the PR `enhancement` or `bug` instead of `dependencies`, and use the matching Conventional-Commit prefix (`feat:` or `fix:`) instead of `chore:`/`build(deps):`. Those bumps deliver real product fixes or features through us, so they should drive a release-please version bump and show up under Features/Bug Fixes in the release notes — not get hidden under "Dependencies" (which doesn't trigger a release).

**Don't run `gh pr merge` yourself.** `pr-auto-review.yml` reviews every PR and adds `ready-to-merge` on a `pass` *or* `warn` verdict; `auto-merge.yml` then arms `gh pr merge --auto --squash`. A `warn` (nits only) still auto-merges; only `fail` blocks until the findings are addressed on the PR. Open a PR only when the change is done — it auto-merges on a passing (or warn) review.

### Auto-review follow-up issues

When a PR's auto-review verdict is `warn` or `fail`, the `chrischall/workflows` pipeline opens or updates a single `auto-review-followup` issue ("Auto-review follow-ups for PR #N") whose checklist captures every finding, and links it from the PR's `<!-- auto-review-verdict -->` comment (`📋 Tracking follow-ups: #N`). `warn` (nits only) still auto-merges — the issue carries the nits forward, so most nits are fixed in a *later* PR; `fail` blocks until the important findings are addressed on the PR itself.

When asked to address the auto-review comments / review findings on a PR:

1. Read the verdict comment, open the linked `auto-review-followup` issue, and treat its checklist as the work list (alongside any inline review comments).
2. Resolve each item, checking off only what you've **verified** is genuinely fixed.
3. If every item is resolved on the current PR, add `Closes #<issue>` to that PR's body so the merge closes it; if some are deferred, check off only the resolved ones and leave the issue open.
4. For nits whose `warn` PR already auto-merged, address them in a follow-up PR that references `Closes #<issue>`.

(Mirrors the fleet-wide convention in `~/.claude/CLAUDE.md`.)
