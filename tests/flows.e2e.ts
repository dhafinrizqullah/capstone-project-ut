import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { Screen } from 'e2e';
import { openPage, settle, signInAs } from './helpers';

// Every "Aktivitas Terbaru" row as one string (name · RW · RT · category · value).
const RECENT_ROWS = `[...document.querySelectorAll('[data-slot="body"] table tbody tr')]
  .map(r => r.innerText.replace(/\\s+/g, ' ')).join(' ~ ')`;

// "Warga Aktif" KPI of the analytics dashboard.
const kpiResidents = (browser: { evaluate: (s: string) => Promise<unknown> }) => browser.evaluate(
  `(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.innerText.includes('Warga Aktif'))
    return card?.querySelectorAll('div')[1]?.textContent?.trim() ?? 'missing'
  })()`,
) as Promise<string>;

/**
 * Renames the category row matching `from` through the Master Harga modal.
 * Missing rows are a no-op so a crashed run can re-normalise itself.
 */
async function renameCategory(screen: Screen, from: RegExp, to: string) {
  await expect(screen.getByText('Plastik PET')).toBeVisible(); // seed guarantees this cell
  const row = screen.getByRole('row', from);
  if (!await row.count()) return;
  await row.getByRole('button', 'Ubah kategori').tap();
  await screen.getByLabel('Nama kategori').fill(to);
  await screen.getByRole('button', 'Simpan').tap();
  await expect(screen.getByText('Harga tersimpan.')).toBeVisible();
}

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
  test('dashboard hides the RW for its own scope and offers the RT filter', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengurus_rw'); // lands on the dashboard
    await expect(screen.getByText('Total Sampah Terkumpul')).toBeVisible();

    await expect(await browser.evaluate(`document.querySelectorAll('canvas').length`)).toBe(3);
    // no RW picker: they only see their own RW, but per-RT filtering is theirs
    await expect(await screen.getByLabel('RW').count()).toBe(0);
    await expect(screen.getByLabel('RT')).toBeVisible();
    // rows name the unit, never the ward
    const rows = await browser.evaluate(RECENT_ROWS) as string;
    await expect(rows).toMatch(/· RT \d\d/);
    await expect(rows).not.toMatch(/RW \d\d/);
  });

  test('the RT filter narrows the KPIs', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengurus_rw');
    await expect(screen.getByText('Total Sampah Terkumpul')).toBeVisible();
    // demo seed: 8 residents in RW 05 — 3 in RT 01
    await expect(await kpiResidents(browser)).toBe('8');

    await screen.getByLabel('RT').tap();
    await screen.getByRole('option', 'RT 01').waitFor({ state: 'visible' });
    await screen.getByRole('option', 'RT 01').tap();
    await expect(await kpiResidents(browser)).toBe('3');
  });

  test('exports the report as an xlsx download, one row per line', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengurus_rw');
    await openPage(app, browser, '/report');

    const download = await browser.waitForDownload(
      () => screen.getByRole('button', 'Unduh Excel').tap(),
      { timeout: 30000 },
    );
    await expect(download.suggestedFilename).toMatch(/^laporan-rw-\d{4}-\d{2}-\d{2}\.xlsx$/);

    // read the workbook back: the summary sheets plus the raw lines
    // (xlsx resolves to its CJS build here, where the functions live on `default`)
    const xlsx = await import('xlsx');
    const XLSX = (xlsx.default ?? xlsx) as typeof xlsx;
    const wb = XLSX.readFile(download.absolutePath);
    await expect(wb.SheetNames).toEqual(['Ringkasan', 'Per kategori', 'Per RT', 'Penimbangan', 'Rincian item']);

    const weighings = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets.Penimbangan!);
    await expect(weighings.length).toBeGreaterThan(10);
    await expect(Object.keys(weighings[0]!)).toEqual(['Tanggal', 'Warga', 'RW', 'RT', 'Berat', 'Nilai']);
    // scoped to the pengurus' own RW, and RW 06 never leaks into the file
    await expect([...new Set(weighings.map(r => r.RW))]).toEqual(['RW 05']);

    const lines = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets['Rincian item']!);
    await expect(lines.length).toBeGreaterThanOrEqual(weighings.length);
    await expect(Object.keys(lines[0]!)).toEqual(['Tanggal', 'Warga', 'RW', 'RT', 'Kategori', 'Berat', 'Harga/kg', 'Nilai']);
  });

  test('the report prints the recap and calls window.print', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengurus_rw');
    await openPage(app, browser, '/report');

    // the recap is on the page, so the printed sheet is not an empty page
    await expect(screen.getByText('Total Sampah Terkumpul')).toBeVisible();
    await expect(screen.getByText('Per kategori')).toBeVisible();
    await expect(screen.getByText('Per RT')).toBeVisible();
    await expect(screen.getByText(/Dibuat:/)).toBeVisible();

    await browser.evaluate(`window.print = () => { window.__printed = true }`);
    await screen.getByRole('button', 'Cetak / PDF').tap();
    await expect(await browser.evaluate(`window.__printed === true`)).toBe(true);

    // the print stylesheet drops the app chrome and prints on light surfaces
    const printCss = await browser.evaluate(`
      [...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
        .filter(r => r.media && String(r.media.mediaText).includes('print'))
        .map(r => r.cssText).join('\\n')
    `) as string;
    await expect(printCss).toMatch(/data-collapsed/);
    await expect(printCss).toMatch(/--ui-bg/);
  });
});

describe('superadmin', () => {
  test('scopes the dashboard by RW and RT', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');
    await openPage(app, browser, '/');

    await expect(screen.getByLabel('RW')).toBeVisible();
    await expect(screen.getByLabel('RT')).toBeVisible();
    // seeing every RW is exactly why the rows carry the ward here
    const rows = await browser.evaluate(RECENT_ROWS) as string;
    await expect(rows).toMatch(/RW \d\d/);
  });

  test('sees every RW: dashboard count and all payout requests', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    // demo seed: 8 residents in RW 05 + 4 in RW 06 (the scoped pengurus_rw sees 8)
    await openPage(app, browser, '/');
    await expect(screen.getByText('Total Sampah Terkumpul')).toBeVisible();
    await expect(await kpiResidents(browser)).toBe('12');

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

describe('history is frozen', () => {
  test('renaming a category does not rewrite past weighings', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'petugas');

    // normalise a crashed run first: the probe rename is only ever ours
    await openPage(app, browser, '/cashier/prices');
    await renameCategory(screen, /Besi Beku/, 'Logam');

    // weigh 3 kg of Logam: it becomes the newest activity row
    await openPage(app, browser, '/cashier');
    await screen.getByLabel('Warga (nasabah)').tap();
    await screen.getByRole('option', /Budi Santoso/).tap();
    await screen.getByLabel('Kategori').tap();
    await screen.getByRole('option', /Logam/).tap();
    await screen.getByLabel('Berat (kg)').fill('3');
    await screen.getByRole('button', 'Tambah ke daftar').tap();
    await screen.getByRole('button', 'Simpan Penimbangan').tap();
    await expect(screen.getByText('Penimbangan tersimpan, saldo warga bertambah.')).toBeVisible();

    // the dashboard labels it with the master's name of the day
    await screen.getByRole('button', 'Keluar').tap();
    await expect(browser).toHaveURL('/login', { timeout: 60000 });
    await signInAs(app, screen, browser, 'superadmin');
    await openPage(app, browser, '/');
    await expect(screen.getByText(/Logam/).first()).toBeVisible();

    // rename the master, then look at history again
    await openPage(app, browser, '/cashier/prices');
    await renameCategory(screen, /Logam/, 'Besi Beku');

    await openPage(app, browser, '/');
    await expect(screen.getByText('Aktivitas Terbaru')).toBeVisible();
    const rows = await browser.evaluate(RECENT_ROWS) as string;
    await expect(rows).toMatch(/Budi Santoso/);
    await expect(rows).toMatch(/Logam/);
    await expect(rows).not.toMatch(/Besi Beku/);

    // restore the master
    await openPage(app, browser, '/cashier/prices');
    await renameCategory(screen, /Besi Beku/, 'Logam');
  });
});
