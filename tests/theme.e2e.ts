import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { openPage, settle, signInAs } from './helpers';

const CARD_BG = `getComputedStyle(document.querySelector('[data-slot="body"] article')).backgroundColor`;
const IS_DARK = `document.documentElement.classList.contains('dark')`;
/** Painted-pixel count + colour hash of the first dashboard canvas (the trend chart). */
const CANVAS = `(() => {
  const c = document.querySelector('[data-slot="body"] canvas');
  if (!c) return null;
  const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let painted = 0, hash = 2166136261;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]) painted++;
    hash = Math.imul(hash ^ px[i] ^ (px[i + 1] << 8) ^ (px[i + 2] << 16), 16777619) >>> 0;
  }
  return { painted, hash };
})()`;
/**
 * Records the colour-mode switch window from inside the page. The window lasts
 * 320ms, which a driver round trip can outlive under load (a tap alone has been
 * seen at 660ms), so the transition is sampled by the observer that sees the
 * class appear, never by a later read: an open window pushes the computed
 * transition property, the closing one pushes ''.
 */
const RECORD_SWITCH = `(() => {
  window.__switchLog = [];
  new MutationObserver(() => {
    const open = document.documentElement.classList.contains('theme-switching');
    window.__switchLog.push(open ? getComputedStyle(document.body).transitionProperty : '');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return true;
})()`;

describe('dark mode', () => {
  test('the sidebar toggle flips the theme, and the choice survives a reload', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');
    // the suite's browser reports no dark preference, so the app starts light
    await expect(await browser.evaluate(IS_DARK)).toBe(false);

    await screen.getByRole('button', 'Beralih ke mode gelap').tap();
    await expect(await browser.evaluate(IS_DARK)).toBe(true);

    // surfaces follow: a card is a dark surface, not a white box
    await openPage(app, browser, '/');
    await expect(screen.getByText('Total Sampah Terkumpul')).toBeVisible();
    const darkCard = await browser.evaluate(CARD_BG) as string;
    await expect(darkCard).not.toBe('rgb(255, 255, 255)');
    // native widgets and the browser chrome follow too
    await expect(await browser.evaluate(`getComputedStyle(document.documentElement).colorScheme`)).toBe('dark');
    await expect(await browser.evaluate(`document.querySelector('meta[name="theme-color"]').content`)).not.toBe('');

    // the preference is stored, so a fresh load stays dark
    await app.open('/');
    await expect(await browser.evaluate(IS_DARK)).toBe(true);

    // and the way back leaves light mode intact (the rest of the suite runs light)
    await screen.getByRole('button', 'Beralih ke mode terang').tap();
    await expect(await browser.evaluate(IS_DARK)).toBe(false);
    await openPage(app, browser, '/');
    await expect(screen.getByText('Total Sampah Terkumpul')).toBeVisible();
    const lightCard = await browser.evaluate(CARD_BG) as string;
    await expect(lightCard).toBe('rgb(255, 255, 255)');
    await expect(await browser.evaluate(`getComputedStyle(document.documentElement).colorScheme`)).toBe('light');
  });

  test('the flip tweens its colours instead of snapping', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');

    await browser.evaluate(RECORD_SWITCH);
    await screen.getByRole('button', 'Beralih ke mode gelap').tap();
    await expect(await browser.evaluate(IS_DARK)).toBe(true);

    // the switch window opened with the flip, and colours tween inside it
    const log = await browser.evaluate(`window.__switchLog`) as string[];
    const open = log.filter(Boolean);
    await expect(open.length).toBeGreaterThan(0);
    await expect(open[0]).toMatch(/background-color/);
    await expect(open[0]).toMatch(/color/);

    // and it closes itself, so ordinary hovers stay instant
    await settle(600);
    const closed = await browser.evaluate(`window.__switchLog`) as string[];
    await expect(closed.at(-1)).toBe('');
    await expect(await browser.evaluate(`document.documentElement.classList.contains('theme-switching')`)).toBe(false);
    await expect(await browser.evaluate(`getComputedStyle(document.body).transitionProperty`)).not.toMatch(/background-color/);
  });

  test('the flip repaints the dashboard charts and leaves them on screen', async ({ app, screen, browser }) => {
    await signInAs(app, screen, browser, 'superadmin');
    // chart.js is imported lazily, so the canvas fills in a moment after the page
    let light: { painted: number, hash: number } | null = null;
    for (let i = 0; i < 40 && !light?.painted; i++) {
      await settle(250);
      light = await browser.evaluate(CANVAS) as { painted: number, hash: number } | null;
    }
    await expect(light?.painted).toBeGreaterThan(0);

    await screen.getByRole('button', 'Beralih ke mode gelap').tap();
    await settle(600);
    const dark = await browser.evaluate(CANVAS) as { painted: number, hash: number } | null;

    // the canvas is still painted (a rebuild leaves it blank for a frame) ...
    await expect(dark?.painted).toBeGreaterThan(0);
    // ... and its grid and labels now use the dark theme's colours
    await expect(dark?.hash).not.toBe(light?.hash);

    await screen.getByRole('button', 'Beralih ke mode terang').tap();
    await settle(600);
  });
});
