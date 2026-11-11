// Run against app/dev with a disposable workspace. BROWSER=webkit checks WKWebView.
import { chromium, webkit } from 'playwright';
import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = process.env.BASE_URL || 'http://127.0.0.1:9245';
  await page.clock.setFixedTime(new Date(2026, 8, 28, 9));
  await page.goto(base);
  await page.keyboard.press('ControlOrMeta+,');
  assert.deepEqual(await page.locator('#theme option').allTextContents(), ['Workbench', 'Terminal', 'Editorial', 'Studio', 'Focus', 'Blueprint']);
  for (const id of await page.locator('#theme option').evaluateAll(options => options.map(o => o.value))) {
    await page.locator('#theme').selectOption(id);
    await page.locator('#theme-mode').selectOption('system');
    const colors = [];
    for (const mode of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: mode });
      await page.waitForFunction(mode => document.documentElement.dataset.theme === mode, mode);
      assert.equal(await page.locator('#theme').inputValue(), id);
      colors.push(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()));
    }
    assert.notEqual(colors[0], colors[1], `${id} has distinct light/dark palettes`);
  }
  await page.locator('#theme-mode').selectOption('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await page.locator('#theme').selectOption('sand');
  await page.locator('#theme-css').fill('/* OrbitalNote Theme v1: Test */\n:root { --accent: #ff1234; }');
  await page.locator('#theme-apply').click();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#ff1234');
  await page.reload();
  await page.keyboard.press('ControlOrMeta+,');
  assert.equal(await page.locator('#theme').inputValue(), 'sand');
  assert.equal(await page.locator('#theme-mode').inputValue(), 'dark');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#ff1234');
  await page.locator('#theme-clear').click();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#d6aa87');
  const custom = await readFile('examples/Themes/studio.orbitalnote.css', 'utf8');
  await page.locator('#theme-mode').selectOption('light');
  await page.locator('#theme-css').fill(custom); await page.locator('#theme-apply').click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'Standalone CSS controls native appearance');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()), '#201d29');
  await page.reload(); await page.keyboard.press('ControlOrMeta+,');
  assert.equal(await page.locator('#theme-css').inputValue(), custom);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await page.locator('#theme-clear').click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()), '#fbf8f2');
  const api = async (method, q = {}) => {
    const r = await page.request.post(base + '/api', { data: { method, ...q } }); assert.ok(r.ok()); return r.json();
  };
  const state = await api('Status'), path = 'appearance-smoke.org';
  const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  await api('Save', { id: state.id, path, source: '* TODO Test task\nBody\n** Child\nChild body\n', revision: old?.revision || '' });
  await page.locator(`#tree [data-open="${path}"]`).click();
  const note = page.locator(`.ui-document[data-path="${path}"]`);
  assert.equal(await page.locator('#quick-open img').count(), 0);
  const heading = note.locator('.org-heading').first(), fold = heading.locator('.editor-heading-fold');
  assert.equal(await fold.evaluate(el => getComputedStyle(el).position), 'absolute');
  await heading.hover();
  await heading.getByRole('button', { name: 'Heading actions', exact: true }).click();
  await page.getByRole('dialog', { name: 'Heading actions' }).getByRole('button', { name: 'Edit task…', exact: true }).click();
  await page.locator('#modal').waitFor({ state: 'visible' });
  await page.locator('.date-picker-grid [data-date="2026-09-28"]').click();
  await page.locator('#modal [name="time"]').fill('12:00');
  await page.getByRole('button', { name: '1 hour', exact: true }).click();
  assert.equal(await page.locator('#modal [name="time"]').inputValue(), '12:00');
  assert.equal(await page.locator('#modal [name="endTime"]').inputValue(), '13:00');
  await page.locator('#modal [name="title"]').fill('Changed with Enter');
  await page.locator('#modal [name="title"]').press('Enter');
  await page.locator('#modal').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('.ui-source')?.value.includes('12:00-13:00'));
  const edited = await note.locator('[data-ui="source"]').evaluate(el => el.value);
  for (const id of ['dark', 'coffee', 'sand', 'plum', 'midnight', 'ocean']) {
    await page.keyboard.press('ControlOrMeta+,');
    await page.locator('#theme').selectOption(id);
    await page.locator(`[data-tab-select="file:${path}"]`).click();
    await note.locator('.ui-preview-toggle').click();
    assert(await note.locator('.ui-preview').isVisible());
    await note.locator('.ui-preview-toggle').click();
    assert.equal(await note.locator('[data-ui="source"]').evaluate(el => el.value), edited, 'Theme changes and reading mode preserve edited Org source');
  }
  for (const side of ['left', 'right']) {
    if (side === 'right' && !(await note.locator('.ui-context').isVisible())) await page.locator('#context-toggle').click();
    const handle = side === 'left' ? page.locator('#sidebar .sidebar-resizer') : note.locator('.sidebar-resizer');
    const bounds = await handle.boundingBox(); assert.ok(bounds);
    await page.mouse.move(bounds.x + 3, bounds.y + 100); await page.mouse.down();
    await page.mouse.move(bounds.x + (side === 'left' ? 60 : -60), bounds.y + 100); await page.mouse.up();
    assert.ok(await page.evaluate(side => Number(localStorage.getItem(`orbitalnote-${side}-width`)) > 260, side));
  }
  const migration = await browser.newPage({ colorScheme: 'light' });
  migration.on('pageerror', e => errors.push(e.message));
  await migration.goto(base);
  const overlay = ':root { --accent: #ff1234; }';
  for (const [old, id, originalMode] of [
    ['light', 'sand', 'light'], ['forest', 'sand', 'dark'], ['nord', 'dark', 'dark'],
    ['rose', 'midnight', 'light'], ['aurora', 'dark', 'dark'], ['ember', 'sand', 'dark'], ['iris', 'plum', 'dark'],
  ]) {
    for (const preference of [null, 'system', 'light', 'dark']) {
      await migration.evaluate(({ old, preference, overlay }) => {
        localStorage.setItem('org-theme', old);
        if (preference) localStorage.setItem('org-theme-mode', preference); else localStorage.removeItem('org-theme-mode');
        localStorage.setItem('orbitalnote-theme-css', overlay);
      }, { old, preference, overlay });
      await migration.reload();
      const expectedMode = preference || originalMode;
      assert.equal(await migration.locator('#theme').inputValue(), id, `${old} migrates to ${id}`);
      assert.equal(await migration.locator('#theme-mode').inputValue(), expectedMode);
      assert.equal(await migration.evaluate(() => document.documentElement.dataset.theme), expectedMode === 'system' ? 'light' : expectedMode);
      assert.deepEqual(await migration.evaluate(() => ['org-theme', 'org-theme-mode', 'orbitalnote-theme-css'].map(key => localStorage.getItem(key))), [id, expectedMode, overlay]);
      assert.equal(await migration.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#ff1234');
    }
  }
  await migration.reload();
  assert.equal(await migration.locator('#theme').inputValue(), 'plum', 'Migrated preferences survive another launch');
  await migration.close();
  assert.deepEqual(errors, []);
  console.log(`PASS (${engine.name()}): six families, light/dark/system appearance, retired-theme migrations, overlay and standalone CSS persistence, source preservation, task editing, and sidebar geometry.`);
} finally { await browser.close(); }
