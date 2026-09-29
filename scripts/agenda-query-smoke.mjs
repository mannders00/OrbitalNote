import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = process.env.BASE_URL || 'http://127.0.0.1:9247';
  await page.goto(base);
  const api = async (method, q = {}) => {
    const r = await page.request.post(base + '/api', { data: { method, ...q } }); assert.ok(r.ok()); return r.json();
  };
  const state = await api('Status'), path = 'query-smoke.org';
  const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  await api('Save', { id: state.id, path, revision: old?.revision || '', source: '#+TODO: TODO NEXT | DONE\n#+FILETAGS: :queryfixture:\n* NEXT Work meeting :office:\nSCHEDULED: <2026-09-28 Mon>\n* TODO Buy milk :home:\n' });
  await page.reload();
  await page.locator('#ribbon [data-view="agenda"]').click();
  await page.locator('[data-filter="all"]').click();
  await page.locator('.agenda-query-builder summary').click();
  const add = async (field, value, operator = 'is') => {
    if (!(await page.locator('.agenda-query-builder').evaluate(el => el.open))) await page.locator('.agenda-query-builder summary').click();
    await page.locator('[data-query-field]').selectOption(field);
    await page.locator('[data-query-operator]').selectOption(operator);
    if (field === 'date') await page.locator('[data-query-value]').fill(value);
    else await page.locator('[data-query-value]').selectOption(value);
    await page.locator('[data-query-add]').click();
  };
  await add('file', path);
  assert.equal(await page.locator('.agenda-entry').count(), 2);
  await add('tag', 'office');
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  assert.match(await page.locator('.agenda-entry').innerText(), /Work meeting/);
  await add('state', 'TODO');
  assert.equal(await page.locator('.agenda-entry').count(), 0);
  await page.getByRole('button', { name: 'Remove filter: Task state is TODO', exact: true }).click();
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  await page.locator('[data-query-clear]').click();
  await add('tag', 'office'); await add('tag', 'home');
  await page.locator('.agenda-query-builder summary').click();
  await page.locator('[data-query-mode]').selectOption('any');
  assert.equal(await page.locator('.agenda-entry').count(), 2);
  await page.locator('#agenda-query').fill('milk');
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  await page.locator('#agenda-query').fill('');
  await page.locator('[data-query-clear]').click();
  await page.locator('[data-query-mode]').selectOption('all');
  await add('tag', 'queryfixture'); await add('date', '2026-09-29', 'before');
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  await page.locator('.agenda-query-builder summary').click();
  await page.locator('[data-view-name]').fill('Research review');
  await page.locator('[data-save-view]').click();
  await page.reload();
  await page.locator('#ribbon [data-view="agenda"]').click();
  assert.equal(await page.locator('[data-saved-view]').inputValue(), 'Research review');
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  await page.locator('[data-saved-view]').selectOption('');
  assert.ok(await page.locator('.agenda-entry').count() >= 2);
  await page.locator('[data-saved-view]').selectOption('Research review');
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  await page.locator('.agenda-query-builder summary').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => { const r = document.querySelector('.query-popup').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.locator('#ribbon [data-view="calendar"]').click();
  await page.locator('[data-calendar="week"]').click();
  for (const width of [1400, 600]) {
    await page.setViewportSize({ width, height: 950 });
    await page.waitForFunction(() => { const headers = [...document.querySelectorAll('.time-day-headers > button')], days = [...document.querySelectorAll('.time-day')]; return headers.length === 7 && headers.every((h, i) => Math.abs(h.getBoundingClientRect().x - days[i].getBoundingClientRect().x) < 1); });
    const cells = await page.locator('.time-day-headers > button').evaluateAll(nodes => nodes.map(n => {
      const rect = n.getBoundingClientRect(); return { x: rect.x, right: rect.right, border: getComputedStyle(n).borderLeftWidth };
    }));
    const columns = await page.locator('.time-day').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().x));
    assert.equal(cells.length, 7);
    cells.forEach((cell, i) => { assert.ok(Math.abs(cell.x - columns[i]) < 1); assert.equal(cell.border, '1px'); if (i) assert.ok(Math.abs(cell.x - cells[i - 1].right) < 1); });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: clickable compound queries, custom states, inherited tags, date/text filtering, removable rules, and gap-free aligned week headers at desktop/narrow widths.');
} finally { await browser.close(); }
