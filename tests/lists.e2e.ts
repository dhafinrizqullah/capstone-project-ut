import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { openPage, searchFor, signInAs } from './helpers';

describe('list pages', () => {
  test('price master searches on the category name', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'petugas');
    await openPage(app, browser, '/cashier/prices');
    await expect(screen.getByText('Plastik PET')).toBeVisible();

    await searchFor(screen, 'plastik', async () => await expect(screen.getByText('Kardus')).toBeHidden());

    // no match: the table's empty state, not a blank card
    await searchFor(screen, 'tidak-ada', async () => await expect(screen.getByText('Belum ada data.')).toBeVisible());

    await searchFor(screen, '', async () => await expect(screen.getByText('Kardus')).toBeVisible());
  });

  test('area master searches on RW and RT', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');
    await openPage(app, browser, '/admin/areas');
    await expect(screen.getByText('RW 05 · RT 01')).toBeVisible();

    await searchFor(screen, 'RW 06', async () => {
      await expect(screen.getByText('RW 06 · RT 01')).toBeVisible();
      await expect(screen.getByText('RW 05 · RT 01')).toBeHidden();
    });
  });

  test('payout validation searches on the resident', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'petugas');
    await openPage(app, browser, '/cashier/payouts');

    const rows = `document.querySelectorAll('tbody tr').length`;
    const before = await browser.evaluate(rows) as number;
    await expect(before).toBeGreaterThanOrEqual(1);

    await searchFor(screen, 'tidak-ada-nama', async () => await expect(screen.getByText('Belum ada data.')).toBeVisible());
    await searchFor(screen, '', async () => await expect(await browser.evaluate(rows) as number).toBe(before));
  });
});
