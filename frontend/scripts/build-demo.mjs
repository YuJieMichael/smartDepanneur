import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: 'true', NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? '/smartDepanneur', NEXT_PUBLIC_API_URL: '', NEXT_TELEMETRY_DISABLED: '1' },
});
if (result.status !== 0) process.exit(result.status ?? 1);
writeFileSync('out/.nojekyll', '');
writeFileSync('out/robots.txt', 'User-agent: *\nDisallow: /\n');
