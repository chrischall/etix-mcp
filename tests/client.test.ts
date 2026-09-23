import { describe, it, expect, vi } from 'vitest';
import { EtixClient, BotWallError } from '../src/client.js';
import type { EtixTransport, FetchResult } from '../src/transport.js';

function stubTransport(result: Partial<FetchResult>): EtixTransport {
  const full: FetchResult = {
    status: 200,
    body: '',
    url: 'https://www.etix.com/',
    ...result,
  };
  return {
    start: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn().mockResolvedValue(full),
    runProbe: vi.fn(),
    status: vi.fn(),
  };
}

const DATADOME_BODY =
  '<html><head><title>etix.com</title></head><body>' +
  "<p id=\"cmsg\">Please enable JS and disable any ad blocker</p>" +
  "<script>var dd={'host':'geo.captcha-delivery.com'}</script></body></html>";

describe('EtixClient', () => {
  it('fetchJson parses a JSON body', async () => {
    const client = new EtixClient({
      transport: stubTransport({ body: '{"keywords":"x","venues":[]}' }),
    });
    await expect(client.fetchJson('/ticket/api/online/search/suggest?keywords=x')).resolves.toEqual({
      keywords: 'x',
      venues: [],
    });
  });

  it('fetchHtml returns the raw body', async () => {
    const client = new EtixClient({
      transport: stubTransport({ body: '<html>ok</html>' }),
    });
    await expect(client.fetchHtml('/ticket/p/1')).resolves.toBe('<html>ok</html>');
  });

  it('raises BotWallError on a DataDome interstitial', async () => {
    const client = new EtixClient({
      transport: stubTransport({ status: 200, body: DATADOME_BODY }),
    });
    await expect(client.fetchHtml('/ticket/p/1')).rejects.toBeInstanceOf(
      BotWallError
    );
  });

  it.each([403, 202, 429])(
    'raises BotWallError (not a generic HTTP error) on a %i DataDome interstitial',
    async (status) => {
      const client = new EtixClient({
        transport: stubTransport({ status, body: DATADOME_BODY }),
      });
      await expect(client.fetchHtml('/ticket/p/1')).rejects.toBeInstanceOf(BotWallError);
      await expect(client.fetchJson('/ticket/api/online/x')).rejects.toBeInstanceOf(
        BotWallError
      );
      await expect(client.postJson('/ticket/api/online/x', {})).rejects.toBeInstanceOf(
        BotWallError
      );
    }
  );

  it('throws a service-tagged error on non-2xx', async () => {
    const client = new EtixClient({
      transport: stubTransport({ status: 404, body: 'not found' }),
    });
    await expect(client.fetchJson('/ticket/api/online/x')).rejects.toThrow(/Etix/);
  });

  it('postJson sends the body and parses the response', async () => {
    const transport = stubTransport({ body: '{"city":"Charlotte"}' });
    const client = new EtixClient({ transport });
    const out = await client.postJson('/ticket/api/online/geolocation/search', {
      cityOrPostalCode: 'Charlotte, NC',
      country: 'USA',
    });
    expect(out).toEqual({ city: 'Charlotte' });
    expect(transport.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/ticket/api/online/geolocation/search',
        body: JSON.stringify({ cityOrPostalCode: 'Charlotte, NC', country: 'USA' }),
      })
    );
  });

  it('postJson forwards retryOnTimeout when the caller marks the POST read-only', async () => {
    const transport = stubTransport({ body: '{}' });
    const client = new EtixClient({ transport });
    await client.postJson('/ticket/api/online/geolocation/search', {}, { retryOnTimeout: true });
    expect(transport.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', retryOnTimeout: true })
    );
  });

  it('postJson does NOT opt into retryOnTimeout by default (writes must not re-send)', async () => {
    const transport = stubTransport({ body: '{}' });
    const client = new EtixClient({ transport });
    await client.postJson('/ticket/api/online/x', { a: 1 });
    const init = vi.mocked(transport.fetch).mock.calls[0]![0];
    expect('retryOnTimeout' in init).toBe(false);
  });

  it('postJson forwards an explicit retryOnTimeout:false so the caller can turn the retry off', async () => {
    const transport = stubTransport({ body: '{}' });
    const client = new EtixClient({ transport });
    await client.postJson('/ticket/api/online/x', { a: 1 }, { retryOnTimeout: false });
    const init = vi.mocked(transport.fetch).mock.calls[0]![0];
    expect(init).toHaveProperty('retryOnTimeout', false);
  });
});
