import { describe, test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { Screen } from 'e2e';

async function waitHydrated(browser: Browser) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const ready = await browser.evaluate(`!!document.querySelector('#__nuxt')?.__vue_app__`);
    if (ready) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('hydration timeout');
}

async function signIn(screen: Screen, email: string, password: string) {
  await screen.getByLabel('Email').fill(email);
  await screen.getByLabel('Kata sandi').fill(password);
  await screen.getByRole('button', 'Masuk ke Dasbor').tap();
}

async function noHorizontalOverflow(browser: Browser) {
  const overflow = await browser.evaluate(
    `document.documentElement.scrollWidth <= window.innerWidth + 1`,
  );
  await expect(overflow as boolean).toBe(true);
}

describe('responsive', () => {
  test('mobile drawer opens with readable menu and no overflow', async ({ app, screen, browser }) => {
    await browser.setViewport({ width: 390, height: 800 });
    await app.open('/login');
    await waitHydrated(browser);
    await signIn(screen, 'superadmin@rw05.id', 'bank-sampah-123');
    await expect(browser).toHaveURL('/admin/users', { timeout: 60000 });
    await screen.getByRole('button', 'Buka sidebar').tap();
    await expect(screen.getByRole('link', 'Kelola Pengguna')).toBeVisible();
    await noHorizontalOverflow(browser);
  });

  test('cashier stacks without overflow on mobile', async ({ app, screen, browser }) => {
    await browser.setViewport({ width: 390, height: 800 });
    await app.open('/login');
    await waitHydrated(browser);
    await signIn(screen, 'petugas@rw05.id', 'bank-sampah-123');
    await expect(browser).toHaveURL('/cashier', { timeout: 60000 });
    await noHorizontalOverflow(browser);
  });
});
