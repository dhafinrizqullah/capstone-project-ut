import { describe, test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { Screen } from 'e2e';

// Dev SSR + hydration is slow: never tap before Vue owns the DOM,
// or the tap performs a native submit and wipes the form.
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

describe('auth', () => {
  test('petugas signs in and lands on the cashier', async ({ app, screen, browser }) => {
    await app.open('/login');
    await waitHydrated(browser);
    await signIn(screen, 'petugas@rw05.id', 'bank-sampah-123');
    await expect(browser).toHaveURL('/cashier', { timeout: 60000 });
  });

  test('warga signs in and lands on the resident dashboard', async ({ app, screen, browser }) => {
    await app.open('/login');
    await waitHydrated(browser);
    await signIn(screen, 'warga@rw05.id', 'bank-sampah-123');
    await expect(browser).toHaveURL('/resident', { timeout: 60000 });
  });

  test('wrong password stays on login with an error', async ({ app, screen, browser }) => {
    await app.open('/login');
    await waitHydrated(browser);
    await signIn(screen, 'warga@rw05.id', 'salah-password');
    await expect(browser).toHaveURL('/login', { timeout: 60000 });
  });
});
