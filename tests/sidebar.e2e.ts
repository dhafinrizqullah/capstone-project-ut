import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { settle, signInAs } from './helpers';

describe('sidebar', () => {
  test('collapses from its own header, with a width transition', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'warga');

    const sidebar = browser.locator('[data-collapsed]');
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    // the control lives in the sidebar header, not next to the page title
    await expect(sidebar.getByRole('button', 'Ciutkan sidebar')).toBeVisible();

    const width = `document.querySelector('[data-collapsed]').getBoundingClientRect().width`;
    const transition = await browser.evaluate(
      `getComputedStyle(document.querySelector('[data-collapsed]')).transitionProperty`,
    );
    await expect(transition).toMatch(/width/);

    const wide = await browser.evaluate(width) as number;
    await sidebar.getByRole('button', 'Ciutkan sidebar').tap();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    await expect(sidebar.getByRole('button', 'Perluas sidebar')).toBeVisible();
    await settle(400); // let the transition land on its final width
    const narrow = await browser.evaluate(width) as number;
    await expect(narrow).toBeLessThan(wide);

    await sidebar.getByRole('button', 'Perluas sidebar').tap();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    await settle(400);
    await expect(await browser.evaluate(width) as number).toBeCloseTo(wide, 0);
  });
});
