import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { NO_OVERFLOW, signInAs, waitHydrated } from './helpers';

describe('responsive', () => {
  test('login card sits in the middle of a 360px screen', async ({ app, screen, browser }) => {
    await browser.setViewport({ width: 360, height: 640 });
    await app.open('/login');
    await waitHydrated(browser);
    await expect(screen.getByRole('heading', 'Masuk')).toBeVisible();

    await expect(await browser.evaluate(NO_OVERFLOW)).toBe(true);
    // the card is centred, not glued to the top (it used to be: the grid was lg-only)
    const box = await browser.evaluate(
      `(() => { const r = document.querySelector('form').parentElement.getBoundingClientRect()
        return JSON.stringify({ top: Math.round(r.top), gap: Math.round(window.innerHeight - r.bottom) }) })()`,
    ) as string;
    const { top, gap } = JSON.parse(box) as { top: number, gap: number };
    await expect(Math.abs(top - gap)).toBeLessThanOrEqual(4);
  });

  test('mobile drawer opens with readable menu and no overflow', async ({ app, screen, browser }) => {
    await browser.setViewport({ width: 390, height: 800 });
    await signInAs(app, screen, browser, 'superadmin');
    await screen.getByRole('button', 'Buka sidebar').tap();
    await expect(screen.getByRole('link', 'Kelola Pengguna')).toBeVisible();
    await expect(await browser.evaluate(NO_OVERFLOW)).toBe(true);
  });

  test('cashier stacks without overflow on mobile', async ({ app, screen, browser }) => {
    await browser.setViewport({ width: 390, height: 800 });
    await signInAs(app, screen, browser, 'petugas');
    await expect(await browser.evaluate(NO_OVERFLOW)).toBe(true);
  });
});
