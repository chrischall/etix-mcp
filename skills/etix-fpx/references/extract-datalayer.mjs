#!/usr/bin/env node
// extract-datalayer.mjs — pull the page-level `dataLayer = [{ 'k' : 'v', ... }]`
// analytics object out of an Etix SSR page (event or venue detail) and print
// it as a flat JSON object on stdout (pipe to `jq`).
//
// Mirrors `extractDataLayer` in etix-mcp's own `src/parse.ts` verbatim — the
// block spans multiple lines in the real page (one `'key' : 'value'` pair
// per line), so a single-line `grep -oE` pass can never match it: grep's `.`
// doesn't match newlines and grep has no lazy quantifier, so `dataLayer\s*=
// \s*\[.*?\]` always comes back empty. Node's regex engine supports both
// (`[\s\S]*?` spans newlines lazily), so this is a plain `node -e`-sized
// port rather than a full parser dependency.
//
// Usage:
//   node extract-datalayer.mjs <html-file|->
//   fpx get 'https://www.etix.com/ticket/p/39004863' -p etix \
//     | node extract-datalayer.mjs - | jq '.org_id, .org_name, .cobrand'

import { readFileSync } from 'node:fs';

const [, , fileArg] = process.argv;
if (!fileArg) {
  console.error('usage: extract-datalayer.mjs <html-file|->');
  process.exit(1);
}

const html = fileArg === '-' ? readFileSync(0, 'utf8') : readFileSync(fileArg, 'utf8');

const block = html.match(/dataLayer\s*=\s*\[\s*\{([\s\S]*?)\}\s*\]/);
if (!block) {
  console.error('extract-datalayer: no "dataLayer = [{...}]" block found in the page');
  process.exit(1);
}

const out = {};
for (const m of block[1].matchAll(/'([\w]+)'\s*:\s*'([^']*)'/g)) {
  out[m[1]] = m[2];
}

console.log(JSON.stringify(out));
