import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { signInAs } from './helpers';

describe('admin users', () => {
  test('role picker offers no superadmin', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    await screen.getByLabel('Peran').tap();
    await screen.getByRole('option', /Warga/).waitFor({ state: 'visible' });
    const options = await browser.evaluate(
      `JSON.stringify([...document.querySelectorAll('[role=option]')].map(o => o.textContent.trim()))`,
    ) as string;
    await expect(options.includes('Superadmin')).toBe(false);
    await expect(options.includes('Warga')).toBe(true);
  });

  test('server refuses to create a superadmin', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    const status = await browser.evaluate(`(async () => {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'sa-should-fail-${Date.now()}@rw05.id',
          password: 'bank-sampah-123',
          full_name: 'Should Not Exist',
          role: 'superadmin',
          rw: 'RW 05',
          rt: '',
        }),
      });
      return r.status;
    })()`) as number;
    await expect(status).toBe(400);
  });

  test('server requires the right scope per role', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    const create = async (body: Record<string, unknown>) => await browser.evaluate(`(async () => {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'scope-probe-${Date.now()}@rw05.id',
          password: 'bank-sampah-123',
          full_name: 'Scope Probe',
          ...${JSON.stringify(body)},
        }),
      });
      return r.status;
    })()`) as number;

    // rejected before any account is created: RW-bound staff need an RW, residents need an area
    await expect(await create({ role: 'petugas' })).toBe(400);
    await expect(await create({ role: 'pengurus_rw' })).toBe(400);
    await expect(await create({ role: 'warga', rw: 'RW 05' })).toBe(400);
  });

  test('language switch flips the UI and animates', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    await expect(screen.getByRole('button', 'Indonesia')).toHaveAttribute('aria-pressed', 'true');
    await screen.getByRole('button', 'English').tap();
    await expect(screen.getByRole('button', 'English')).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.getByText('Manage Users').first()).toBeVisible();
  });

  test('validation messages follow the active locale', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    // Indonesian (default): plain words, no zod jargon
    await screen.getByRole('button', 'Buat Pengguna').tap();
    await expect(screen.getByText('Wajib diisi.').first()).toBeVisible();
    await expect(screen.getByText('Format email tidak valid.')).toBeVisible();
    await expect(screen.getByText('Minimal 8 karakter.')).toBeVisible();

    // switching to English re-validates in English
    await screen.getByRole('button', 'English').tap();
    await screen.getByRole('button', 'Create User').tap();
    await expect(screen.getByText('Required.').first()).toBeVisible();
    await expect(screen.getByText('Enter a valid email address.')).toBeVisible();
    await expect(screen.getByText('At least 8 characters.')).toBeVisible();
  });

  test('area fields follow the role: warga needs RW+RT, RW-bound staff needs RW', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    const pickRole = async (label: RegExp) => {
      await screen.getByLabel('Peran').tap();
      await screen.getByRole('option', label).waitFor({ state: 'visible' });
      await screen.getByRole('option', label).tap();
    };

    await pickRole(/Warga/);
    await expect(screen.getByLabel('RW')).toBeVisible();
    await expect(screen.getByLabel('RT')).toBeVisible();

    // a resident with no unit must not submit (state.rt starts empty)
    await screen.getByRole('button', 'Buat Pengguna').tap();
    await expect(screen.getByText('RW dan RT wajib diisi untuk warga.')).toBeVisible();

    for (const staff of [/Petugas/, /Pengurus RW/]) {
      await pickRole(staff);
      await expect(screen.getByLabel('RW')).toBeVisible();
      await expect(screen.getByLabel('RT')).toBeHidden();
    }

    await pickRole(/Pengepul/);
    await expect(screen.getByLabel('RW')).toBeHidden();
    await expect(screen.getByLabel('RT')).toBeHidden();
  });

  test('the list carries the RW of staff profiles too', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    // seeded admin@rw05.id is pengurus_rw, scoped through profiles.rw (it has no area, so no RT)
    await screen.getByPlaceholder('Cari…').fill('admin@rw05.id');
    await expect(screen.getByText('admin@rw05.id')).toBeVisible();
    await expect(screen.getByText('RW 05')).toBeVisible();
    await expect(screen.getByText('RT 01')).toBeHidden();

    // residents keep their RW · RT from the area
    await screen.getByPlaceholder('Cari…').fill('warga@rw05.id');
    await expect(screen.getByText('warga@rw05.id')).toBeVisible();
    await expect(screen.getByText('RW 05')).toBeVisible();
    await expect(screen.getByText('RT 01')).toBeVisible();
  });

  test('panel body children enter with the rise animation', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    const style = await browser.evaluate(
      `getComputedStyle(document.querySelector('[data-slot="body"] > *')).animationName`,
    );
    await expect(style).toBe('page-rise');
  });
});
