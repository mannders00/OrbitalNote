import { chromium, webkit } from 'playwright';
import { strict as assert } from 'node:assert';
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = process.env.BASE_URL || 'http://127.0.0.1:9247';
  await page.goto(base);
  const choose = async (selector, value, root = '#agenda') => {
    const saved = selector === '[data-saved-view]';
    if (saved && await page.locator(root + ' [data-quick-view] + .task-file-picker').isVisible()) selector = '[data-quick-view]';
    const select = page.locator(root).locator(selector), input = page.locator(root).locator(`${selector} + .task-file-picker input`);
    if (selector !== '[data-quick-view]' && !await page.locator(root + ' details.agenda-query-builder').evaluate(el => el.open)) await page.locator(root + ' summary').click();
    const label = await select.evaluate((el, value) => [...el.options].find(o => o.value === value).textContent, value);
    await input.click(); await input.fill(label);
    await page.locator('#' + await input.getAttribute('aria-controls')).getByRole('option', { name: label, exact: true }).click();
    if (saved && await page.locator(root + ' .query-popup').isVisible()) await page.locator(root).getByRole('button', { name: 'Close filters', exact: true }).click();
  };
  const api = async (method, q = {}) => {
    const r = await page.request.post(base + '/api', { data: { method, ...q } }); assert.ok(r.ok()); return r.json();
  };
  const state = await api('Status'), path = 'query-smoke.org';
  const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  await api('Save', { id: state.id, path, revision: old?.revision || '', source: '#+TODO: TODO NEXT | DONE\n#+FILETAGS: :queryfixture:\n* NEXT Work meeting :office:\nSCHEDULED: <2026-09-28 Mon>\n* TODO Buy milk :home:\n' });
  await page.reload();
  await page.locator('#ribbon [data-view="agenda"]').click();
  await page.locator('[data-filter="all"]').click();
  await page.locator('#agenda .agenda-query-builder summary').click();
  const add = async (field, value, operator = 'is') => {
    if (!(await page.locator('#agenda .agenda-query-builder').evaluate(el => el.open))) await page.locator('#agenda .agenda-query-builder summary').click();
    await choose('[data-query-field]', field);
    await choose('[data-query-operator]', operator);
    if (field === 'date') await page.locator('#agenda [data-query-value]').fill(value);
    else await choose('[data-query-value]', value);
    await page.locator('#agenda [data-query-add]').click();
    assert.equal(await page.locator('#agenda .agenda-query-builder').evaluate(el => el.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.matches('.agenda-query-builder summary')), true);
  };
  await add('file', path);
  assert.equal(await page.locator('.agenda-entry').count(), 2);
  await add('tag', 'office');
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  assert.match(await page.locator('.agenda-entry').innerText(), /Work meeting/);
  await add('state', 'TODO');
  assert.equal(await page.locator('.agenda-entry').count(), 0);
  await page.locator('#agenda .agenda-query-builder summary').click();
  await page.getByRole('button', { name: 'Remove filter: Task state is TODO', exact: true }).click();
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  await page.locator('#agenda [data-query-clear]').click();
   assert.equal(await page.evaluate(() => document.activeElement.matches('[data-query-field] + .task-file-picker input')), true);
  await add('tag', 'office'); await add('tag', 'home');
  await page.locator('#agenda .agenda-query-builder summary').click();
  await choose('[data-query-mode]', 'any');
  assert.equal(await page.locator('.agenda-entry').count(), 2);
  await page.locator('#agenda-query').fill('milk');
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  await page.locator('#agenda-query').fill('');
  if (!(await page.locator('#agenda .agenda-query-builder').evaluate(el => el.open))) await page.locator('#agenda .agenda-query-builder summary').click();
  await page.locator('#agenda [data-query-clear]').click();
  await choose('[data-query-mode]', 'all');
  await add('tag', 'queryfixture'); await add('date', '2026-09-29', 'before');
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  await page.locator('#agenda .agenda-query-builder summary').click();
  await page.locator('#agenda [data-view-name]').fill('Research review');
  await page.locator('#agenda [data-save-view]').click();
  await page.reload();
  await page.locator('#ribbon [data-view="agenda"]').click();
  assert.equal(await page.locator('#agenda [data-saved-view]').inputValue(), 'Research review');
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  await choose('[data-saved-view]', '');
  assert.ok(await page.locator('.agenda-entry').count() >= 2);
  await choose('[data-saved-view]', 'Research review');
  assert.equal(await page.locator('.agenda-entry').count(), 1);
  await page.locator('#agenda .agenda-query-builder summary').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => { const r = document.querySelector('.query-popup').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
  assert(await page.locator('#agenda [data-query-value] + .task-file-picker').evaluate(el => Math.abs(el.getBoundingClientRect().width - el.closest('.query-value-label').getBoundingClientRect().width) < 1), 'Mobile value controls use the full panel width');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.matches('.agenda-query-builder summary')), true);
  assert(await page.locator('#agenda .query-popup').isHidden());
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Close filters', exact: true }).click();
  assert.equal(await page.locator('#agenda .agenda-query-builder summary').getAttribute('aria-expanded'), 'false');
  await page.keyboard.press('Enter');
  await page.locator('#agenda .page-heading h1').click();
  assert(await page.locator('#agenda .query-popup').isHidden(), 'Outside clicks dismiss the panel');
  await page.locator('#agenda .agenda-query-builder summary').click();
  await page.locator('#agenda [data-delete-view]').click();
  assert.equal(await page.locator('#agenda [data-saved-view]').inputValue(), '');
  assert.equal(await page.locator('.agenda-entry').count(), 1, 'Deleting a saved view retains its current filters');
  assert.equal(await page.evaluate(() => document.activeElement.matches('[data-view-name]')), true);
  await page.setViewportSize({ width: 390, height: 360 });
  await page.waitForFunction(() => { const r = document.querySelector('.query-popup').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  await page.locator('#agenda [data-save-view]').scrollIntoViewIfNeeded();
  assert(await page.locator('#agenda [data-save-view]').isVisible());
  await page.getByRole('button', { name: 'Close filters', exact: true }).click();
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.locator('#ribbon [data-view="calendar"]').click();
  assert.equal(await page.locator('#calendar-summary').count(), 0);
  await page.locator('#calendar summary').click();
  await choose('[data-query-field]', 'file', '#calendar');
  await choose('[data-query-value]', path, '#calendar');
  await page.locator('#calendar [data-query-add]').click();
  await page.locator('#calendar summary').click();
  await page.locator('#calendar [data-view-name]').fill('Calendar review');
  await page.locator('#calendar [data-save-view]').click();
  await page.reload();
  await page.locator('#ribbon [data-view="calendar"]').click();
  assert.equal(await page.locator('#calendar [data-saved-view]').inputValue(), 'Calendar review');
  assert.equal(await page.locator('#calendar [data-rule-count]').textContent(), '3');
  assert.equal(await page.locator('#agenda [data-rule-count]').textContent(), '3', 'Calendar edits and the active saved view restore in both planners');
  await page.locator('[data-calendar="week"]').click();
  for (const width of [1400, 600]) {
    await page.setViewportSize({ width, height: 950 });
    await page.waitForFunction(() => { const headers = [...document.querySelectorAll('.time-day-headers > button')], days = [...document.querySelectorAll('.time-day')]; return document.querySelector('#calendar').getBoundingClientRect().right <= innerWidth && headers.length === 7 && headers.every((h, i) => Math.abs(h.getBoundingClientRect().x - days[i].getBoundingClientRect().x) < 1); });
    const cells = await page.locator('.time-day-headers > button').evaluateAll(nodes => nodes.map(n => {
      const rect = n.getBoundingClientRect(), column = document.querySelectorAll('.time-day')[nodes.indexOf(n)].getBoundingClientRect().x;
      return { x: rect.x, right: rect.right, border: getComputedStyle(n).borderLeftWidth, column };
    }));
    assert.equal(cells.length, 7);
    cells.forEach((cell, i) => { assert.ok(Math.abs(cell.x - cell.column) < 1, JSON.stringify({ width, cell })); assert.equal(cell.border, '1px'); if (i) assert.ok(Math.abs(cell.x - cells[i - 1].right) < 1); });
  }
  const touch = await browser.newPage({ viewport: { width: 320, height: 844 }, hasTouch: true, isMobile: true });
  touch.on('pageerror', e => errors.push(e.message));
  await touch.addInitScript(key => {
    const name = 'Weekly research and delivery review with a long saved title';
    const query = { range: 'all', text: '', kind: '', mode: 'any', rules: [
      { field: 'tag', operator: 'is', value: 'queryfixture' }, { field: 'state', operator: 'is', value: 'TODO' },
      { field: 'file', operator: 'is', value: 'research/averylongunbrokenprojectfoldernametocheckwrapping/review.org' },
    ] };
    localStorage.setItem('orbitalnote-agenda-views-' + key, JSON.stringify({ active: name, views: [{ name, query }] }));
  }, state.key);
  await touch.goto(base); await touch.locator('#ribbon [data-view="agenda"]').tap();
  for (let i = 0; i < 3; i++) {
    await touch.locator('#agenda .agenda-query-builder summary').tap();
    await touch.getByRole('combobox', { name: 'Filter', exact: true }).fill('Date');
    await touch.getByRole('option', { name: 'Date', exact: true }).tap();
    await touch.locator('#agenda [data-query-value]').fill('2026-09-28');
    assert(await touch.locator('#agenda .query-popup').evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && el.scrollWidth <= el.clientWidth;
    }), 'Tall panels with long rules stay contained and usable after reopening on touch screens');
    await touch.getByRole('button', { name: 'Close filters', exact: true }).tap();
    assert(await touch.locator('#agenda .query-popup').isHidden());
  }
  await touch.close();
  assert.deepEqual(errors, []);
  console.log('PASS: compound queries, custom states, inherited tags, date/text filtering, saved-view round trips/deletion, responsive popover controls and dismissal/focus, and aligned week headers.');
} finally { await browser.close(); }
