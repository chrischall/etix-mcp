/**
 * Small helpers for shaping tool responses that the MCP SDK expects.
 *
 * Every `etix_*` tool returns exactly one text block via `minifiedResult`,
 * which is the fleet-shared, byte-identical `JSON.stringify(data, null, 2)`
 * text wrapper re-exported from `@chrischall/mcp-utils`. Tools keep
 * importing `minifiedResult` from `../mcp.js` while the implementation lives
 * upstream.
 */
export { minifiedResult } from '@chrischall/mcp-utils';
