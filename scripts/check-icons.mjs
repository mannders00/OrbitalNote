// No browser required: catch outdated platform assets before packaging.
import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import { iconManifest } from './icon-assets.mjs';

assert.deepEqual(await iconManifest(), JSON.parse(await readFile('app/build/icon-manifest.json', 'utf8')),
  'Stale app icons. Run scripts/render-brand.mjs --app-only and commit all generated icons.');
console.log('PASS: all platform icons match the recorded artwork and renderers.');
