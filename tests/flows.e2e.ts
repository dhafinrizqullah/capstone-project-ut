import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { Screen } from 'e2e';
import { openPage, searchFor, settle, signInAs } from './helpers';

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
    // the typed weight is what lands in the list: "2.5" means 2,5 kg, never 25 or 2,1
    await expect(screen.getByText('2,5 kg')).toBeVisible();

    await screen.getByRole('button', 'Simpan Penimbangan').tap();
    await expect(screen.getByText('Penimbangan tersimpan, saldo warga bertambah.')).toBeVisible();
  });

  test('reads a weight typed with either separator, and refuses a non-number', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'petugas'); // lands on /cashier

    await screen.getByLabel('Kategori').tap();
    await screen.getByRole('option', /Kardus/).tap();

    // the id-ID keyboard gives a comma
    await screen.getByLabel('Berat (kg)').fill('2,5');
    await screen.getByRole('button', 'Tambah ke daftar').tap();
    await expect(screen.getByText('2,5 kg')).toBeVisible();

    // a plain integer stays a plain integer
    await screen.getByLabel('Kategori').tap();
    await screen.getByRole('option', /Organik/).tap();
    await screen.getByLabel('Berat (kg)').fill('3');
    await screen.getByRole('button', 'Tambah ke daftar').tap();
    await expect(screen.getByText('3 kg')).toBeVisible();

    // junk is refused with a warning instead of being guessed at
    await screen.getByLabel('Kategori').tap();
    await screen.getByRole('option', /Kaca/).tap();
    await screen.getByLabel('Berat (kg)').fill('dua kg');
    await screen.getByRole('button', 'Tambah ke daftar').tap();
    await expect(screen.getByText('Berat wajib diisi dan harus berupa angka.')).toBeVisible();
  });

  test('price field keeps the amount that was typed', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'petugas');
    await openPage(app, browser, '/cashier/prices');

    // an off-grid price must survive the field: 3.100, not the step grid's 3.000
    await screen.getByRole('button', 'Kategori baru').tap();
    await screen.getByLabel('Nama kategori').fill('Probe');
    await screen.getByLabel('Harga per kg (Rp)').fill('3100');
    await screen.getByLabel('Nama kategori').tap(); // blur applies the field value
    const shown = await browser.evaluate(
      `document.querySelector('[role="dialog"] input[role="spinbutton"]').value`,
    );
    await expect(shown).toBe('3.100');

    await browser.keyboard.press('Escape'); // nothing is created by this test
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

describe('self-service drop-off', () => {
  test('a resident declares a weight, the operator re-weighs it, the final weight stands', async ({ app, screen, browser }) => {
    // A. the resident drops off at home and declares the weight
    await signInAs(app, screen, browser, 'warga');
    await screen.getByLabel('Kategori').tap();
    await screen.getByRole('option', /Organik/).tap();
    await screen.getByLabel('Berat (kg)').fill('7,7');
    await screen.getByRole('button', 'Tambah ke daftar').tap();
    await expect(screen.getByText('7,7 kg').first()).toBeVisible();
    await screen.getByRole('button', 'Kirim Setoran').tap();
    await expect(screen.getByText('Setoran terkirim, menunggu verifikasi petugas RW.')).toBeVisible();

    // pending, still at the declared weight, nothing credited yet
    await expect(screen.getByRole('row', /7,7 kg[\s\S]*Menunggu/)).toBeVisible();

    // B. the operator re-weighs it before it counts
    await screen.getByRole('button', 'Keluar').tap();
    await expect(browser).toHaveURL('/login', { timeout: 60000 });
    await signInAs(app, screen, browser, 'petugas');
    await openPage(app, browser, '/cashier/verify');

    // newest pending request of this resident (leftovers of a crashed run sort first)
    const request = screen.getByRole('row', /Budi Santoso/).last();
    await expect(request.getByText('7,7 kg')).toBeVisible();
    await request.getByRole('button', 'Verifikasi').tap();

    const dialog = screen.getByRole('dialog');
    await expect(dialog.getByText(/Berat diajukan warga: 7,7 kg/)).toBeVisible();
    await dialog.getByLabel('Organik').fill('8,8');
    await dialog.getByRole('button', 'Simpan Hasil Timbang').tap();
    await expect(screen.getByText('Setoran diverifikasi, saldo warga bertambah.')).toBeVisible();

    // C. the resident only ever sees the final weight (newest row, rows are newest-first)
    await screen.getByRole('button', 'Keluar').tap();
    await expect(browser).toHaveURL('/login', { timeout: 60000 });
    await signInAs(app, screen, browser, 'warga');
    await expect(screen.getByRole('row', /8,8 kg[\s\S]*Tercatat/).first()).toBeVisible();
  });
});

describe('pengepul', () => {
  test('opens a handover note and reads its items', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengepul'); // lands on /handover

    await expect(screen.getByText(/No\. nota/).first()).toBeVisible();
    const note = screen.getByRole('button', /No\. nota/).first();
    // the row has to announce itself as the control: chevron, hint label, expanded state
    await expect(note).toHaveAttribute('aria-expanded', 'false');
    await expect(screen.getByText('Lihat rincian').first()).toBeVisible();
    await note.tap();
    await expect(note).toHaveAttribute('aria-expanded', 'true');
    await expect(screen.getByText('Rincian muatan')).toBeVisible();
    await expect(screen.getByText('Tutup rincian').first()).toBeVisible();
  });

  test('searches the note list', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengepul');

    // the seeded notes are what they are: read the numbers off the page.
    // the number span sits before the date span with no text separator, so take the number alone.
    const numbers = `[...document.querySelectorAll('[data-slot="body"] button[aria-expanded]')]
      .map(b => b.querySelector('span > span').textContent.replace('No. nota', '').trim())`;
    const cards = `document.querySelectorAll('[data-slot="body"] button[aria-expanded]').length`;
    const before = await browser.evaluate(numbers) as string[];
    await expect(before.length).toBeGreaterThanOrEqual(1);
    await expect(screen.getByPlaceholder('Cari…')).toBeVisible();

    const target = before[0]!;
    await searchFor(screen, target, async () => {
      await expect(screen.getByText(new RegExp(`No\\. nota ${target}`))).toBeVisible();
      await expect(await browser.evaluate(cards) as number).toBe(1);
    });

    await searchFor(screen, 'SJ-999999', async () => {
      await expect(screen.getByText('Belum ada data.')).toBeVisible();
      await expect(await browser.evaluate(numbers) as string[]).toEqual([]);
    });
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

  test('the report downloads the recap as a pdf file', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'pengurus_rw');
    await openPage(app, browser, '/report');

    // the recap is on the page, so the pdf is not an empty page
    await expect(screen.getByText('Total Sampah Terkumpul')).toBeVisible();
    await expect(screen.getByText('Per kategori')).toBeVisible();
    await expect(screen.getByText('Per RT')).toBeVisible();
    await expect(screen.getByText(/Dibuat:/)).toBeVisible();

    const download = await browser.waitForDownload(
      () => screen.getByRole('button', 'Cetak / PDF').tap(),
      { timeout: 30000 },
    );
    await expect(download.suggestedFilename).toMatch(/^laporan-rw-\d{4}-\d{2}-\d{2}\.pdf$/);

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
