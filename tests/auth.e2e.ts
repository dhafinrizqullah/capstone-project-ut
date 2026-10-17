import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { signInAs, signInWith } from './helpers';

describe('auth', () => {
  test('petugas signs in and lands on the cashier', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'petugas');
    await expect(browser).toHaveURL('/cashier');
  });

  test('warga signs in and lands on the resident dashboard', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'warga');
    await expect(browser).toHaveURL('/resident');
  });

  test('wrong password stays on login with an error', async ({ app, screen, browser }) => {
    await signInWith(app, screen, browser, 'warga@rw05.id', 'salah-password', '/login');
    await expect(screen.getByText(/Email atau kata sandi salah/)).toBeVisible();
  });
});
