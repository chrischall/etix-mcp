import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractDataLayer } from '../src/parse.js';

// The etix-fpx skill ships a standalone port of `extractDataLayer`; it must
// stay in step with src/parse.ts (including escaped-apostrophe handling).
const SCRIPT = fileURLToPath(
  new URL('../skills/etix-fpx/references/extract-datalayer.mjs', import.meta.url)
);

describe('skills/etix-fpx extract-datalayer.mjs', () => {
  it('keeps escaped apostrophes and decodes entities', () => {
    const html =
      "<script>dataLayer = [{ 'org_name' : 'Bojangles\\' Coliseum', 'venue_name' : 'Brewer&#39;s &amp; Co' }]</script>";
    const out = execFileSync(process.execPath, [SCRIPT, '-'], { input: html, encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual({
      org_name: "Bojangles' Coliseum",
      venue_name: "Brewer's & Co",
    });
  });

  it('decodes exactly as the server does (mcp-utils decodeHtmlEntities is the reference)', () => {
    const html =
      "<script>dataLayer = [{ 'a' : 'Jazz&nbsp;Club', 'b' : '&amp;lt;b&amp;gt;', 'c' : '&#x41;&#66;', " +
      "'d' : '&#999999999999;', 'e' : '&copy; Etix', 'f' : 'Tom &AMP; Jerry', 'g' : 'Bojangles\\' \\x41' }]</script>";
    const out = execFileSync(process.execPath, [SCRIPT, '-'], { input: html, encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual(extractDataLayer(html));
  });
});
