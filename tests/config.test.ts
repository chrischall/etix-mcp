import { describe, it, expect } from 'vitest';
import { DEFAULT_PORT, bridgePort } from '../src/config.js';

// fleet-audit#430: ETIX_WS_PORT used to go through a bare Number(), so junk
// became NaN (or an out-of-range port) and failed at listen() with an opaque
// RangeError, while the banner printed "NaN".
describe('bridgePort', () => {
  it('defaults to the shared fleet port 37149', () => {
    expect(DEFAULT_PORT).toBe(37149);
    expect(bridgePort({})).toBe(37149);
  });

  it('reads a valid ETIX_WS_PORT', () => {
    expect(bridgePort({ ETIX_WS_PORT: '47149' })).toBe(47149);
  });

  it.each(['abc', '0', '70000', '1.5', '0x10', '${ETIX_WS_PORT}'])(
    'falls back to 37149 for junk %j instead of NaN',
    (raw) => {
      expect(bridgePort({ ETIX_WS_PORT: raw })).toBe(37149);
    }
  );
});
