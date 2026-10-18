import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

describe('link preview', () => {
  /**
   * Raw response, not the hydrated DOM: that is what a chat crawler sees, and it is
   * also the only thing this spec needs — so it never waits for Vue to boot.
   */
  const rawHtml = `fetch('/login').then(r => r.text())`;

  test('the server-rendered page carries absolute Open Graph tags', async ({ app, browser }) => {
    await app.open('/login');

    const html = await browser.evaluate(rawHtml) as string;
    await expect(html).toMatch(/<meta property="og:title" content="Bank Sampah RW Digital">/);
    await expect(html).toMatch(/<meta property="og:description" content="Pilah sampah dari rumah/);
    // relative URLs are dropped silently by every crawler, so these must be absolute
    await expect(html).toMatch(/<meta property="og:url" content="https?:\/\/[^"]+"/);
    await expect(html).toMatch(/<meta property="og:image" content="https?:\/\/[^"]+\/og\.jpg">/);
    await expect(html).toMatch(/<meta property="og:image:width" content="1200">/);
    await expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image">/);
  });

  test('the preview image is served without a session', async ({ app, browser }) => {
    await app.open('/login');

    const image = await browser.evaluate(
      `fetch('/og.jpg').then(async r => r.status + '|' + r.headers.get('content-type') + '|' + (await r.blob()).size)`,
    ) as string;
    const [status, type, size] = image.split('|');
    await expect(status).toBe('200');
    await expect(type).toBe('image/jpeg');
    // WhatsApp drops heavy images: keep it well under its limit
    await expect(Number(size)).toBeLessThan(300000);
  });
});
