import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const specDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every implemented console leaf must be opened by some Playwright spec.
 * Roadmap leaves (implemented: false) stay out of this gate.
 */
test('every implemented console page is covered by a web UI spec', () => {
  const menuSource = fs.readFileSync(
    path.resolve(specDir, '../../src/nav/consoleMenu.js'),
    'utf8',
  );
  const implementedIds = [...menuSource.matchAll(/id:\s*'([^']+)'[^\n]*implemented:\s*true/g)].map(
    (match) => match[1],
  );
  expect(implementedIds.length).toBeGreaterThan(0);

  const specText = fs
    .readdirSync(specDir)
    .filter((name) => name.endsWith('.spec.ts') && name !== 'implemented-menu-coverage.spec.ts')
    .map((name) => fs.readFileSync(path.join(specDir, name), 'utf8'))
    .join('\n');

  const missing = implementedIds.filter((id) => !specText.includes(`menu-${id}`));
  expect(missing, `implemented pages missing a Playwright spec: ${missing.join(', ')}`).toEqual([]);
});
