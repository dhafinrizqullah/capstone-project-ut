import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { openPage, settle, signInAs } from './helpers';

describe('petugas', () => {
  test('records a weighing and credits the resident', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'petugas'); // lands on /cashier

    await screen.getByLabel('Warga (nasabah)').tap();
    await screen.getByRole('option', /Budi Santoso/).tap();
    await screen.getByLabel('Kategori').tap();
    await screen.getByRole('option', /Plastik PET/).tap();
    await screen.getByLabel('Berat (kg)').fill('2.5');
    await screen.getByRole('button', 'Tambah ke daftar').tap();
    await expect(screen.getByText(/Plastik PET/).last()).toBeVisible();

    await screen.getByRole('button', 'Simpan Penimbangan').tap();
    await expect(screen.getByText('Penimbangan tersimpan, saldo warga bertambah.')).toBeVisible();
  });

  test('sees a pending payout with both decisions available', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'petugas');
    await openPage(app, browser, '/cashier/payouts');

    await expect(screen.getByText(/Maya Putri/)).toBeVisible();
    await expect(screen.getByRole('button', 'Setujui').first()).toBeVisible();
    await expect(screen.getByRole('button', 'Tolak').first()).toBeVisible();
  });

  test('lists the last shipments with their status', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'petugas');
    await openPage(app, browser, '/cashier/shipments');

    await expect(screen.getByText('Pengiriman Terakhir')).toBeVisible();
    await expect(screen.getByText(/SJ-/).first()).toBeVisible();
  });

  test('serves only its own RW: residents and payout requests', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'petugas'); // seeded petugas@rw05.id → RW 05

    // the resident picker lists every in-scope resident, so an RW 06 name proves a leak
    await screen.getByLabel('Warga (nasabah)').tap();
    await screen.getByRole('option', /Budi Santoso/).waitFor({ state: 'visible' });
    const options = await browser.evaluate(
      `[...document.querySelectorAll('[role=option]')].map(o => o.textContent).join(' ~ ')`,
    ) as string;
    await expect(options).toMatch(/Budi Santoso/);
    await expect(options).not.toMatch(/Nina Sari/);
    await browser.keyboard.press('Escape');

    await openPage(app, browser, '/cashier/payouts');
    await expect(screen.getByText(/Maya Putri/)).toBeVisible();
    await expect(screen.getByText(/Nina Sari/)).toBeHidden();
  });
});

describe('warga', () => {
  test('sees balance, prices, and weighing history', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'warga'); // lands on /resident
    await settle(1000); // balance arrives after the initial fetch

    await expect(screen.getByText('Saldo Tabungan')).toBeVisible();
    await expect(screen.getByText(/Plastik PET/)).toBeVisible();
    await expect(screen.getByRole('button', 'Kirim Pengajuan')).toBeVisible();
    await expect(screen.getByText('Riwayat Timbangan')).toBeVisible();

    // demo seed gives the resident months of weighings
    const rows = await browser.evaluate(`document.querySelectorAll('tbody tr').length`);
    await expect(rows).toBeGreaterThanOrEqual(1);
  });
});

describe('pengepul', () => {
  test('opens a handover note and reads its items', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengepul'); // lands on /handover

    await expect(screen.getByText(/No\. nota/).first()).toBeVisible();
    await screen.getByRole('button', /No\. nota/).first().tap();
    await expect(screen.getByText('Rincian muatan')).toBeVisible();
  });
});

describe('pengurus_rw', () => {
  test('dashboard renders KPIs and charts, without the superadmin RW/RT filter', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengurus_rw'); // lands on the dashboard
    await expect(screen.getByText('Total Sampah Terkumpul')).toBeVisible();

    await expect(await browser.evaluate(`document.querySelectorAll('canvas').length`)).toBe(3);
    await expect(await screen.getByLabel('RW').count()).toBe(0);
    await expect(await screen.getByLabel('RT').count()).toBe(0);
  });

  test('dashboard is scoped to its own RW', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengurus_rw'); // seeded admin@rw05.id → RW 05
    await expect(screen.getByText('Total Sampah Terkumpul')).toBeVisible();

    // demo seed: 8 residents in RW 05, 4 in RW 06 — unscoped would show 12
    const kpi = await browser.evaluate(
      `(() => {
        const card = [...document.querySelectorAll('article')].find(a => a.innerText.includes('Warga Aktif'))
        return card?.querySelectorAll('div')[1]?.textContent?.trim() ?? 'missing'
      })()`,
    ) as string;
    await expect(kpi).toBe('8');
  });

  test('exports the report as an xlsx download', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengurus_rw');
    await openPage(app, browser, '/report');

    const download = await browser.waitForDownload(
      () => screen.getByRole('button', 'Unduh Excel').tap(),
      { timeout: 30000 },
    );
    await expect(download.suggestedFilename).toMatch(/^laporan-rw-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});

describe('superadmin', () => {
  test('scopes the dashboard by RW and RT', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');
    await openPage(app, browser, '/');

    await expect(screen.getByLabel('RW')).toBeVisible();
    await expect(screen.getByLabel('RT')).toBeVisible();
  });

  test('sees every RW: dashboard count and all payout requests', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    // demo seed: 8 residents in RW 05 + 4 in RW 06 (the scoped pengurus_rw sees 8)
    await openPage(app, browser, '/');
    await expect(screen.getByText('Total Sampah Terkumpul')).toBeVisible();
    const kpi = await browser.evaluate(
      `(() => {
        const card = [...document.querySelectorAll('article')].find(a => a.innerText.includes('Warga Aktif'))
        return card?.querySelectorAll('div')[1]?.textContent?.trim() ?? 'missing'
      })()`,
    ) as string;
    await expect(kpi).toBe('12');

    // the RW 06 pending request the RW 05 operator must not see
    await openPage(app, browser, '/cashier/payouts');
    await expect(screen.getByText(/Maya Putri/)).toBeVisible();
    await expect(screen.getByText(/Nina Sari/)).toBeVisible();
  });

  test('creates and deletes an area', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');
    await openPage(app, browser, '/admin/areas');

    // a crashed run can leave the probe area behind; clear it so runs repeat
    const leftover = screen.getByRole('button', 'RW 99 RT 99');
    if (await leftover.count()) await leftover.tap();

    await screen.getByRole('button', 'Tambah wilayah').tap();
    const dialog = screen.getByRole('dialog');
    await dialog.getByLabel('RW').fill('RW 99');
    await dialog.getByLabel('RT').fill('RT 99');
    await dialog.getByRole('button', 'Tambah wilayah').tap();
    await expect(screen.getByText('Wilayah tersimpan.')).toBeVisible();

    await screen.getByRole('button', 'RW 99 RT 99').tap();
    await expect(screen.getByText('Wilayah dihapus.')).toBeVisible();
  });
});
