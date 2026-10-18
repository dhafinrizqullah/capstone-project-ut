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
    // overflow-y-auto computes overflow-x to auto too: the nav, still laid out at full width while
    // the rail animates, made the OS paint a horizontal scrollbar above the footer (a white bar)
    const bodyOverflowX = `getComputedStyle(document.querySelector('[data-collapsed] [data-slot="body"]')).overflowX`;
    const transition = await browser.evaluate(
      `getComputedStyle(document.querySelector('[data-collapsed]')).transitionProperty`,
    );
    await expect(transition).toMatch(/width/);

    const wide = await browser.evaluate(width) as number;
    await settle(400);
    await expect(await browser.evaluate(bodyOverflowX) as string).toBe('hidden');
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

  test('reopening the rail leaves the dashboard charts inside the panel', async ({ app, screen, browser }) => {
    // a canvas keeps its last pixel width as intrinsic size: without min-w-0 the
    // chart column never shrinks back and the panel body grows a scrollbar
    await browser.setViewport({ width: 1440, height: 900 });
    await signInAs(app, screen, browser, 'pengurus_rw');

    const overflow = `(() => { const b = [...document.querySelectorAll('[data-slot="body"]')].at(-1)
      return b.scrollWidth - b.clientWidth })()`;
    await expect(await browser.evaluate(overflow) as number).toBeLessThanOrEqual(1);

    await browser.locator('[data-collapsed]').getByRole('button', 'Ciutkan sidebar').tap();
    await settle(500);
    await browser.locator('[data-collapsed]').getByRole('button', 'Perluas sidebar').tap();
    await settle(600);
    await expect(await browser.evaluate(overflow) as number).toBeLessThanOrEqual(1);
  });
});
