import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { HOME, NO_OVERFLOW, openPage, signInAs, waitForPage } from './helpers';
import type { RoleKey } from './helpers';

// Every page the app has, with the navbar heading it must render.
const PAGES = {
  dash: { path: '/', title: 'Dasbor Analitik Timbulan Sampah' },
  resident: { path: '/resident', title: 'Dasbor Warga' },
  cashier: { path: '/cashier', title: 'Kasir Timbangan' },
  prices: { path: '/cashier/prices', title: 'Master Harga Sampah' },
  payouts: { path: '/cashier/payouts', title: 'Validasi Pencairan' },
  shipments: { path: '/cashier/shipments', title: 'Kirim ke Pengepul' },
  handover: { path: '/handover', title: 'Nota Serah Terima' },
  report: { path: '/report', title: 'Laporan RW' },
  users: { path: '/admin/users', title: 'Kelola Pengguna' },
  areas: { path: '/admin/areas', title: 'Wilayah RW / RT' },
  denied: { path: '/denied', title: 'Akses ditolak' },
} as const;

// The sidebar menu each role gets, in DOM order (layouts/dashboard.vue).
const MENU: Record<RoleKey, string[]> = {
  warga: ['Dasbor Warga'],
  petugas: ['Kasir Timbangan', 'Master Harga', 'Validasi Pencairan', 'Kirim ke Pengepul'],
  pengepul: ['Nota Serah Terima'],
  pengurus_rw: ['Dasbor Analitik', 'Master Harga', 'Laporan RW'],
  superadmin: [
    'Dasbor Analitik',
    'Dasbor Warga',
    'Kasir Timbangan',
    'Master Harga',
    'Validasi Pencairan',
    'Kirim ke Pengepul',
    'Nota Serah Terima',
    'Laporan RW',
    'Kelola Pengguna',
    'Wilayah RW / RT',
  ],
};

const ROLES: Record<RoleKey, { pages: Array<keyof typeof PAGES>, denied: string[] }> = {
  warga: {
    pages: ['resident', 'denied'],
    denied: ['/', '/cashier', '/cashier/prices', '/cashier/payouts', '/cashier/shipments', '/handover', '/report', '/admin/users', '/admin/areas'],
  },
  petugas: {
    pages: ['cashier', 'prices', 'payouts', 'shipments', 'denied'],
    denied: ['/', '/resident', '/handover', '/report', '/admin/users', '/admin/areas'],
  },
  pengepul: {
    pages: ['handover', 'denied'],
    denied: ['/', '/resident', '/cashier', '/cashier/prices', '/cashier/payouts', '/cashier/shipments', '/report', '/admin/users', '/admin/areas'],
  },
  pengurus_rw: {
    pages: ['dash', 'prices', 'report', 'denied'],
    denied: ['/resident', '/cashier', '/cashier/payouts', '/cashier/shipments', '/handover', '/admin/users', '/admin/areas'],
  },
  superadmin: {
    pages: ['dash', 'resident', 'cashier', 'prices', 'payouts', 'shipments', 'handover', 'report', 'users', 'areas', 'denied'],
    denied: [],
  },
};

for (const role of Object.keys(ROLES) as RoleKey[]) {
  const spec = ROLES[role];

  describe(`${role}`, () => {
    test('menu is role-filtered, its pages open, others bounce home', async ({ app, screen, browser }) => {
      await signInAs(app, screen, browser, role);

      const links = await screen.getByRole('navigation').getByRole('link').allTextContents();
      await expect(links.map(l => l.trim())).toEqual(MENU[role]);

      for (const key of spec.pages) {
        const page = PAGES[key];
        await openPage(app, browser, page.path);
        await expect(screen.getByRole('heading', page.title).first()).toBeVisible();
      }

      for (const path of spec.denied) {
        await app.open(path);
        await expect(browser).toHaveURL(HOME[role], { timeout: 60000 });
      }
    });
  });
}

describe('guards', () => {
  test('an anonymous visitor is sent to /login', async ({ app, screen, browser }) => {
    await app.open('/cashier/payouts');
    await expect(browser).toHaveURL('/login', { timeout: 60000 });
    await expect(screen.getByRole('heading', 'Masuk')).toBeVisible();
  });

  test('a signed-in user is kept off /login and lands on its home', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'warga');
    await app.open('/login');
    await expect(browser).toHaveURL('/resident', { timeout: 60000 });
    await waitForPage(browser, '/resident');
  });
});

describe('mobile', () => {
  test('every page fits 360px with a reachable menu', async ({ app, screen, browser }) => {
    await browser.setViewport({ width: 360, height: 800 });
    await signInAs(app, screen, browser, 'superadmin');

    for (const key of ROLES.superadmin.pages) {
      await openPage(app, browser, PAGES[key].path);
      // every page needs the drawer toggle: /denied shipped without a navbar once
      await expect(screen.getByRole('button', /sidebar/).first()).toBeVisible();
      await expect(await browser.evaluate(NO_OVERFLOW)).toBe(true);
    }

    // the last page of the walk is /denied — open its drawer for real
    await expect(screen.getByRole('link', 'Kelola Pengguna')).toBeHidden();
    await screen.getByRole('button', 'Buka sidebar').tap();
    await expect(screen.getByRole('link', 'Kelola Pengguna')).toBeVisible();
    await expect(await browser.evaluate(NO_OVERFLOW)).toBe(true);
  });
});
