import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { openPage, settle, signInAs } from './helpers';

const CARD_BG = `getComputedStyle(document.querySelector('[data-slot="body"] article')).backgroundColor`;
const IS_DARK = `document.documentElement.classList.contains('dark')`;

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

    await screen.getByRole('button', 'Beralih ke mode gelap').tap();
    // the switch window is open right after the flip, and colours tween in it
    await expect(await browser.evaluate(IS_DARK)).toBe(true);
    await expect(await browser.evaluate(`document.documentElement.classList.contains('theme-switching')`)).toBe(true);
    const tween = await browser.evaluate(`getComputedStyle(document.body).transitionProperty`) as string;
    await expect(tween).toMatch(/background-color/);
    await expect(tween).toMatch(/color/);

    // and it closes itself, so ordinary hovers stay instant
    await settle(600);
    await expect(await browser.evaluate(`document.documentElement.classList.contains('theme-switching')`)).toBe(false);
    await expect(await browser.evaluate(`getComputedStyle(document.body).transitionProperty`)).not.toMatch(/background-color/);
  });
});
