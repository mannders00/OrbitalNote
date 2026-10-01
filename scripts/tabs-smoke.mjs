// Run against the dev host with a disposable workspace on :9240.
// NODE_PATH=<external playwright installation>/node_modules CHROMIUM=<browser> bun scripts/tabs-smoke.mjs
import { chromium, webkit } from 'playwright';
import { strict as assert } from 'node:assert';

const browser = process.env.BROWSER === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
const base = process.env.BASE_URL || 'http://127.0.0.1:9240';
page.on('pageerror', error => errors.push(error.message));
const api = async (method, q = {}) => {
  const response = await page.request.post(base + '/api', { data: { method, ...q } });
  assert.ok(response.ok(), await response.text());
  return response.json();
};
const file = path => page.locator(`.ui-document[data-path="${path}"]`);
const groupOf = async element => page.locator(`[data-group="${await element.evaluate(el => el.closest('[data-owner-group]').dataset.ownerGroup)}"]`);
const waitSaved = async path => {
  await page.waitForFunction(path => document.querySelector(`.ui-document[data-path="${path}"] .ui-save-state`)?.textContent === 'Saved to disk', path);
};
const drag = async (id, target, edge) => {
  const box = await target.boundingBox();
  const positions = { left: { x: 4, y: box.height / 2 }, right: { x: box.width - 4, y: box.height / 2 }, top: { x: box.width / 2, y: 40 }, bottom: { x: box.width / 2, y: box.height - 4 }, center: { x: box.width / 2, y: box.height / 2 } };
  await page.locator(`[data-tab-id="${id}"]`).hover();
  await page.mouse.down();
  await page.mouse.move(box.x + positions[edge].x, box.y + positions[edge].y, { steps: 12 });
  await page.mouse.move(box.x + positions[edge].x, box.y + positions[edge].y);
  await page.mouse.up();
};
try {
  await page.clock.setFixedTime(new Date(2026, 8, 24, 12));
  await page.goto(base);
  await page.locator('#agenda').waitFor({ state: 'visible' });
  const state = await api('Status');
  const initial = '* TODO Split fixture\r\nSCHEDULED: <2026-09-24 Thu>\r\n\n' + 'Wrapped paragraph with words '.repeat(60) + '\n';
  for (const [path, source] of [['tabs-smoke.org', initial], ['tabs-second.org', '* Second note\n']]) {
    const existing = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
    await api('Save', { id: state.id, path, source, revision: existing?.revision || '' });
  }
  await page.locator('#tree [data-open="tabs-smoke.org"]').waitFor();
  await page.locator('#tree [data-open="tabs-smoke.org"]').click();
  await page.locator('#ribbon [data-view="calendar"]').click();
  await page.locator('[data-tab-select="file:tabs-smoke.org"]').click();
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  const beforeTab = page.locator('[data-tab-id="file:tabs-smoke.org"]'), beforeBox = await beforeTab.boundingBox();
  await page.locator('[data-tab-id="view:calendar"]').dispatchEvent('dragstart', { dataTransfer: transfer });
  await beforeTab.dispatchEvent('dragover', { dataTransfer: transfer, clientX: beforeBox.x + 2, clientY: beforeBox.y + 12 });
  await page.locator('.tab-insertion-marker').waitFor({state:'visible'});
  const marker = await page.locator('.tab-insertion-marker').boundingBox();
  assert.ok(Math.abs(marker.x - beforeBox.x) < 3);
  await beforeTab.dispatchEvent('drop', { dataTransfer: transfer, clientX: beforeBox.x + 2, clientY: beforeBox.y + 12 });
  assert.ok(await page.locator('.tab-insertion-marker').isHidden());
  const order = await page.locator('.tab-items [data-tab-id]').evaluateAll(nodes => nodes.map(n => n.dataset.tabId));
  assert.equal(order.indexOf('view:calendar') + 1, order.indexOf('file:tabs-smoke.org'));
  await page.locator('[data-tab-select="file:tabs-smoke.org"]').click();
  await drag('view:calendar', page.locator('.tab-group'), 'right');
  assert.equal(await page.locator('.tab-group').count(), 2);
  assert.ok(await page.locator('#calendar').isVisible());
  const editor = file('tabs-smoke.org').locator('.ui-source');
  assert.ok(await editor.isVisible());
  assert.ok(await editor.evaluate(el => el.classList.contains('cm-lineWrapping')));
  assert.ok(await editor.evaluate(el => el.scrollWidth <= el.clientWidth));
  assert.equal(await file('tabs-smoke.org').locator('.cm-editor').count(), 1);

  // No save command: a calendar in another pane updates after the typing pause.
  const addition = '\n* TODO Automatic live update\nSCHEDULED: <2026-09-24 Thu>\n';
  await editor.fill(await editor.evaluate(el => el.value) + addition);
  await page.locator('#calendar .calendar-event', { hasText: 'Automatic live update' }).waitFor();
  await waitSaved('tabs-smoke.org');
  // The first click in an unfocused built-in pane must perform the action,
  // rather than being consumed by a focus-time rerender.
  await page.locator('#calendar [data-calendar="week"]').click();
  assert.equal(await page.locator('#calendar-grid .time-day').count(), 7);
  await page.locator('#calendar [data-calendar="month"]').click();
  const saved = await api('Read', { id: state.id, path: 'tabs-smoke.org' });
  assert.equal(saved.source, initial + addition); // Soft wrapping must not add newlines or normalize existing EOLs.
  const toggle = file('tabs-smoke.org').locator('.ui-preview-toggle');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-label'), 'Edit source');
  assert.ok(await file('tabs-smoke.org').locator('.ui-preview').isVisible());
  assert.equal(await editor.isVisible(), false);
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-label'), 'Read preview');
  assert.equal(await page.locator('button[data-mode="split"]').count(), 0);

  // A second editor is independent, and delayed saves keep their original path.
  await page.locator('#tree [data-open="tabs-second.org"]').click();
  await drag('file:tabs-second.org', await groupOf(page.locator('#calendar')), 'bottom');
  assert.equal(await page.locator('.tab-group').count(), 3);
  assert.ok(await editor.isVisible());
  const second = file('tabs-second.org').locator('.ui-source');
  await second.fill('* Second note\nSaved from an unfocused pane\n');
  await editor.fill(await editor.evaluate(el => el.value) + '\nFirst note still independent\n');
  await waitSaved('tabs-smoke.org'); await waitSaved('tabs-second.org');
  assert.match((await api('Read', { id: state.id, path: 'tabs-second.org' })).source, /Saved from an unfocused pane/);
  assert.match((await api('Read', { id: state.id, path: 'tabs-smoke.org' })).source, /First note still independent/);

  // Editing again while a write is in flight must schedule the newer buffer,
  // even when another pane gains focus before the first response comes back.
  let releaseSave, saveStarted, delayed = false;
  const release = new Promise(resolve => { releaseSave = resolve; });
  const started = new Promise(resolve => { saveStarted = resolve; });
  const delaySave = async route => {
    const body = route.request().postDataJSON();
    if (!delayed && body?.method === 'Save' && body.path === 'tabs-second.org') { delayed = true; saveStarted(); await release; }
    await route.continue();
  };
  await page.route('**/api', delaySave);
  await second.fill('* Slow save\nFirst revision\n');
  await started;
  await second.fill('* Slow save\nLatest revision while saving\n');
  await editor.focus(); releaseSave();
  await waitSaved('tabs-second.org');
  await page.unroute('**/api', delaySave);
  assert.equal((await api('Read', { id: state.id, path: 'tabs-second.org' })).source, '* Slow save\nLatest revision while saving\n');

  // Resizing reflows both the textarea and syntax mirror without document pan.
  const divider = page.locator('.split-divider').first();
  await divider.focus(); await page.keyboard.press('ArrowRight');
  assert.ok(await editor.evaluate(el => el.scrollWidth <= el.clientWidth));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id));
  assert.equal(ids.length, new Set(ids).size);

  // Persist the layout and reopen its files and built-in views after reload.
  await file('tabs-second.org').locator('.ui-preview-toggle').click();
  await page.reload();
  await page.locator('#calendar').waitFor({ state: 'visible' });
  await file('tabs-smoke.org').locator('.ui-source').waitFor({ state: 'visible' });
  await file('tabs-second.org').locator('.ui-preview').waitFor({ state: 'visible' });
  assert.equal(await file('tabs-second.org').locator('.ui-preview-toggle').getAttribute('aria-label'), 'Edit source');
  await file('tabs-second.org').locator('.ui-preview-toggle').click();
  await file('tabs-second.org').locator('.ui-source').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.tab-group').count(), 3);

  // Native undo survives a tab move; moving to a tab strip merges the group.
  await second.focus(); await page.keyboard.press('End'); await page.keyboard.type('undo-marker');
  await second.evaluate(el => el.undo());
  assert.equal((await second.evaluate(el => el.value)).includes('undo-marker'), false, 'undo before moving');
  await second.evaluate(el => el.redo());
  await drag('file:tabs-second.org', await groupOf(file('tabs-smoke.org')), 'center');
  assert.equal(await page.locator('.tab-group').count(), 2);
  await second.focus(); await second.evaluate(el => el.undo());
  assert.equal((await second.evaluate(el => el.value)).includes('undo-marker'), false);
  await waitSaved('tabs-second.org');

  // Disk conflicts keep the local buffer, stop auto-save, and require resolution.
  await page.locator('[data-tab-select="file:tabs-smoke.org"]').click();
  const disk = await api('Read', { id: state.id, path: 'tabs-smoke.org' });
  await editor.fill(await editor.evaluate(el => el.value) + '\nLocal conflict buffer\n');
  await api('Save', { id: state.id, path: 'tabs-smoke.org', source: disk.source + '\nExternal change\n', revision: disk.revision });
  await file('tabs-smoke.org').locator('.ui-conflict').waitFor({ state: 'visible' });
  assert.match(await editor.evaluate(el => el.value), /Local conflict buffer/);
  assert.doesNotMatch((await api('Read', { id: state.id, path: 'tabs-smoke.org' })).source, /Local conflict buffer/);
  await page.locator('[data-tab-close="file:tabs-smoke.org"]').click();
  await page.locator('#modal').waitFor({ state: 'visible' });
  await page.locator('#modal .modal-actions [value="cancel"]').click();
  assert.ok(await editor.isVisible());
  await file('tabs-smoke.org').locator('.ui-reload-file').click();
  await page.locator('#modal-submit').click();
  await file('tabs-smoke.org').locator('.ui-conflict').waitFor({ state: 'hidden' });
  assert.match(await editor.evaluate(el => el.value), /External change/);

  await page.locator('[data-tab-close="view:calendar"]').click();
  assert.equal(await page.locator('.tab-group').count(), 1);
  await page.locator('#ribbon [data-view="calendar"]').click();
  assert.ok(await page.locator('#calendar').isVisible());
  assert.deepEqual(errors, []);
  console.log('PASS: soft wrap/EOL preservation, preview toggle, nested draggable/resizable splits, independent auto-saves, live calendar, layout restore, undo after tab move, conflict preservation, group collapse.');
} catch (error) {
  console.error('Page errors:', errors);
  console.error(await page.locator('.ui-document').evaluateAll(els => els.map(el => ({ path: el.dataset.path, hidden: el.hidden, mode: el.querySelector('.ui-panes').dataset.mode, toggle: el.querySelector('.ui-preview-toggle').outerHTML, bounds: el.getBoundingClientRect().toJSON() }))));
  throw error;
} finally { await browser.close(); }
