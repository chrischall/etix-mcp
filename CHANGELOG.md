# Changelog

## [0.5.0](https://github.com/chrischall/etix-mcp/compare/v0.4.5...v0.5.0) (2026-08-29)


### Features

* **deps:** take @fetchproxy/server 2.2.0 so the concentrator can bind its sandbox address ([#64](https://github.com/chrischall/etix-mcp/issues/64)) ([bce395c](https://github.com/chrischall/etix-mcp/commit/bce395c20373d6c812ad6f58388124e31cb9f4ef))

## [0.4.5](https://github.com/chrischall/etix-mcp/compare/v0.4.4...v0.4.5) (2026-08-28)


### Bug Fixes

* **egress:** declare every host the server dials in mint.yaml ([#62](https://github.com/chrischall/etix-mcp/issues/62)) ([8040392](https://github.com/chrischall/etix-mcp/commit/804039256fde0dde84d3cc7c03bf6fea8e143514))

## [0.4.4](https://github.com/chrischall/etix-mcp/compare/v0.4.3...v0.4.4) (2026-08-26)


### Bug Fixes

* tidy the etix mint.yaml egress and .mcpbignore ([#56](https://github.com/chrischall/etix-mcp/issues/56)) ([aed007d](https://github.com/chrischall/etix-mcp/commit/aed007d929530820e1a04d7e23bce1d851f4d63c)), closes [#55](https://github.com/chrischall/etix-mcp/issues/55)


### Documentation

* **skill:** declare the name this skill actually publishes under ([#59](https://github.com/chrischall/etix-mcp/issues/59)) ([e9bf546](https://github.com/chrischall/etix-mcp/commit/e9bf546e3eb9269fdc0740219e6f343735f4d1ff))

## [0.4.3](https://github.com/chrischall/etix-mcp/compare/v0.4.2...v0.4.3) (2026-08-06)


### Bug Fixes

* **deps:** move to @fetchproxy/server 2.0.0 for the v3 handshake ([#45](https://github.com/chrischall/etix-mcp/issues/45)) ([b1da770](https://github.com/chrischall/etix-mcp/commit/b1da770b6789e862160a0e8290c3e60e49ed8de3))

## [0.4.2](https://github.com/chrischall/etix-mcp/compare/v0.4.1...v0.4.2) (2026-07-30)


### Bug Fixes

* **deps:** bump @fetchproxy/* to 1.7.0 and @chrischall/mcp-utils to 0.14.0 ([#37](https://github.com/chrischall/etix-mcp/issues/37)) ([04361ef](https://github.com/chrischall/etix-mcp/commit/04361ef8726343138967547c1bc92f393f8dfd99))

## [0.4.1](https://github.com/chrischall/etix-mcp/compare/v0.4.0...v0.4.1) (2026-07-19)


### Documentation

* replace duplicated fleet policy with a pointer ([#29](https://github.com/chrischall/etix-mcp/issues/29)) ([cd5bf87](https://github.com/chrischall/etix-mcp/commit/cd5bf87a50fe268fe7edf240eec8a8682dbad1e1))

## [0.4.0](https://github.com/chrischall/etix-mcp/compare/v0.3.0...v0.4.0) (2026-07-13)


### Features

* **skill:** add etix fpx access skill ([#22](https://github.com/chrischall/etix-mcp/issues/22)) ([1554992](https://github.com/chrischall/etix-mcp/commit/15549929c729a2290e4b7edfa0f765a6f49b3346)), closes [#23](https://github.com/chrischall/etix-mcp/issues/23)


### Refactor

* **skill:** move root SKILL.md into skills/, point plugin.json at ./skills/ ([#24](https://github.com/chrischall/etix-mcp/issues/24)) ([0dc5cd6](https://github.com/chrischall/etix-mcp/commit/0dc5cd644024543aa142204400a37c7d7c81437c))

## [0.3.0](https://github.com/chrischall/etix-mcp/compare/v0.2.1...v0.3.0) (2026-07-07)


### Features

* adopt @chrischall/mcp-utils 0.12.0 (detail hook + scrape subpath) ([#16](https://github.com/chrischall/etix-mcp/issues/16)) ([4102870](https://github.com/chrischall/etix-mcp/commit/41028709762c8d1b37befd1fdfb761d13be8a490))


### Refactor

* adopt registerBridgeHealthcheckTool + shared BotWallError + scrape readers ([#14](https://github.com/chrischall/etix-mcp/issues/14)) ([d9b354f](https://github.com/chrischall/etix-mcp/commit/d9b354f77b07162d2b7f92e1a99730d708bb6b5f))


### Documentation

* document first-party dependency-bump label exception ([#17](https://github.com/chrischall/etix-mcp/issues/17)) ([ba20392](https://github.com/chrischall/etix-mcp/commit/ba20392ee4a8aaa3ff241867c08623173dff09f5))

## [0.2.1](https://github.com/chrischall/etix-mcp/compare/v0.2.0...v0.2.1) (2026-07-03)


### Documentation

* document Conventional Commit PR-title requirement for release-please ([#4](https://github.com/chrischall/etix-mcp/issues/4)) ([db6eaec](https://github.com/chrischall/etix-mcp/commit/db6eaecd0a7c37d167735ef6eddfcc6572a7d7e0))
* refresh CLAUDE.md audit + add auto-review follow-up convention ([#6](https://github.com/chrischall/etix-mcp/issues/6)) ([4c0b008](https://github.com/chrischall/etix-mcp/commit/4c0b0088fa21a54ec19e8268534784dcb9d7e876))

## [0.2.0](https://github.com/chrischall/etix-mcp/compare/v0.1.0...v0.2.0) (2026-06-12)


### Features

* initial etix-mcp — Etix event discovery via fetchproxy ([31d74e5](https://github.com/chrischall/etix-mcp/commit/31d74e52bbeeee13117d4b9b96f40ae74389c883))
