import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

const url = process.env.APP_URL ?? 'http://localhost:3000';

export default {
  targets: [{
    engine: web(),
    app: {
      url,
      // Readiness probe for the command below (200-499 counts).
      readyUrl: `${url}/login`,
      // The runner starts the dev server when nothing answers yet, and reuses a
      // dev shell a developer already has running instead of spawning a second one.
      command: {
        executable: 'pnpm',
        args: ['dev'],
        startupTimeout: 120000,
        reuseExisting: true,
        log: '.e2e/dev-server.log',
      },
    },
  }],
} satisfies E2EConfig;
