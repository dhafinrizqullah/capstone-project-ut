import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { NO_OVERFLOW, signInAs } from './helpers';

describe('responsive', () => {
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
