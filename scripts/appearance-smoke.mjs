import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = process.env.BASE_URL || 'http://127.0.0.1:9245';
  await page.goto(base);
  await page.keyboard.press('ControlOrMeta+,');
  assert.equal(await page.locator('#theme option').count(), 11);
  await page.locator('#theme').selectOption('forest');
  await page.locator('#theme-css').fill('/* OrbitalNote Theme v1: Test */\n:root { --accent: #ff1234; }');
  await page.locator('#theme-apply').click();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#ff1234');
  await page.reload();
  await page.keyboard.press('ControlOrMeta+,');
  assert.equal(await page.locator('#theme').inputValue(), 'forest');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#ff1234');
  await page.locator('#theme-clear').click();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#91c9a0');
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
  await page.locator('#modal [name="date"]').fill('2026-09-28');
  await page.getByRole('button', { name: 'Noon', exact: true }).click();
  await page.getByRole('button', { name: '1 hour', exact: true }).click();
  assert.equal(await page.locator('#modal [name="time"]').inputValue(), '12:00');
  assert.equal(await page.locator('#modal [name="endTime"]').inputValue(), '13:00');
  await page.locator('#modal [name="title"]').fill('Changed with Enter');
  await page.locator('#modal [name="title"]').press('Enter');
  await page.locator('#modal').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('.ui-source')?.value.includes('12:00-13:00'));
  for (const side of ['left', 'right']) {
    if (side === 'right' && !(await note.locator('.ui-context').isVisible())) await page.locator('#context-toggle').click();
    const handle = side === 'left' ? page.locator('#sidebar .sidebar-resizer') : note.locator('.sidebar-resizer');
    const bounds = await handle.boundingBox(); assert.ok(bounds);
    await page.mouse.move(bounds.x + 3, bounds.y + 100); await page.mouse.down();
    await page.mouse.move(bounds.x + (side === 'left' ? 60 : -60), bounds.y + 100); await page.mouse.up();
    assert.ok(await page.evaluate(side => Number(localStorage.getItem(`orbitalnote-${side}-width`)) > 260, side));
  }
  assert.deepEqual(errors, []);
  console.log('PASS: themes/custom CSS persistence, task hover editing, time presets, Enter save, resizable sidebars, icon and folding geometry.');
} finally { await browser.close(); }
