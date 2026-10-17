import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { App, Screen } from 'e2e';

/** Dev password shared by every seeded account (scripts/seed-users.mjs). */
export const PASSWORD = 'bank-sampah-123';

export type RoleKey = 'warga' | 'petugas' | 'pengepul' | 'pengurus_rw' | 'superadmin';

// Mirrors HOME_BY_ROLE in app/middleware/role.ts. That module cannot be imported
// here (it calls defineNuxtRouteMiddleware at import time), so a drift on either
// side has to fail a test — this table is what the role specs assert against.
export const HOME: Record<RoleKey, string> = {
  warga: '/resident',
  petugas: '/cashier',
  pengepul: '/handover',
  pengurus_rw: '/',
  superadmin: '/',
};

export const EMAIL: Record<RoleKey, string> = {
  warga: 'warga@rw05.id',
  petugas: 'petugas@rw05.id',
  pengepul: 'pengepul@rw05.id',
  pengurus_rw: 'admin@rw05.id',
  superadmin: 'superadmin@rw05.id',
};

export const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * `browser.evaluate` fails when the dev server reloads the page mid-call
 * ("Execution context was destroyed"): on a cold start Vite's first compile
 * triggers exactly that. Polling loops only care about the answer, so a failed
 * read counts as "not ready yet" and the caller's deadline decides.
 */
async function read(browser: Browser, script: string) {
  try {
    return await browser.evaluate(script);
  }
  catch {
    return false;
  }
}

// Dev SSR + hydration is slow: never tap before Vue owns the DOM,
// or the tap performs a native submit and wipes the form.
export async function waitHydrated(browser: Browser) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await read(browser, `!!document.querySelector('#__nuxt')?.__vue_app__`)) return;
    await settle(500);
  }
  throw new Error('hydration timeout');
}

/**
 * Waits for `path`'s panel body to be on screen. The previous page's DOM lingers
 * through a client-side swap, so every read that Playwright does not retry
 * (`count()`, `evaluate()`, computed styles) has to wait on this first.
 */
export async function waitForPage(browser: Browser, path: string) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const ready = await read(
      browser,
      `location.pathname === ${JSON.stringify(path)} && !!document.querySelector('[data-slot="body"] > *')`,
    );
    if (ready) return;
    await settle(200);
  }
  throw new Error(`page ${path} did not render`);
}

export async function openPage(app: App, browser: Browser, path: string) {
  await app.open(path);
  await waitHydrated(browser);
  await waitForPage(browser, path);
}

/** Opens /login and waits for the form to be interactive. */
export async function openLogin(app: App, browser: Browser) {
  await app.open('/login');
  await waitHydrated(browser);
}

export async function submitLogin(screen: Screen, email: string, password: string) {
  await screen.getByLabel('Email').fill(email);
  await screen.getByLabel('Kata sandi').fill(password);
  await screen.getByRole('button', 'Masuk ke Dasbor').tap();
}

export async function signInAs(app: App, screen: Screen, browser: Browser, role: RoleKey) {
  await openLogin(app, browser);
  await submitLogin(screen, EMAIL[role], PASSWORD);
  await expect(browser).toHaveURL(HOME[role], { timeout: 60000 });
  await waitForPage(browser, HOME[role]);
}

/** Sends `email`/`password` and waits for a URL, for the failure cases too. */
export async function signInWith(app: App, screen: Screen, browser: Browser, email: string, password: string, path: string) {
  await openLogin(app, browser);
  await submitLogin(screen, email, password);
  await expect(browser).toHaveURL(path, { timeout: 60000 });
}

/** True while the document needs no horizontal scroll. */
export const NO_OVERFLOW = 'document.documentElement.scrollWidth <= window.innerWidth + 1';
