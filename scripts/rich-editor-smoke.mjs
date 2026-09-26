// Uses a disposable workspace served by app/dev on :9240.
import { chromium, webkit } from 'playwright';
import { strict as assert } from 'node:assert';
const browser = process.env.BROWSER === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const api = async (method, data = {}) => { const response = await page.request.post('http://127.0.0.1:9240/api', { data: { method, ...data } }); assert.ok(response.ok(), await response.text()); return response.json(); };
const editor = page.locator('#source');
const saved = () => page.waitForFunction(() => document.getElementById('save-state')?.textContent === 'Saved to disk');
try {
  await page.clock.setFixedTime(new Date(2026, 8, 26, 12));
  await page.goto('http://127.0.0.1:9240'); await page.locator('#agenda').waitFor({ state: 'visible' });
  const state = await api('Status');
  const path = 'rich-editor.org';
  const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  const initial = '* TODO Planning *bold text* :work:\r\nSCHEDULED: <2026-09-26 09:00-10:30>\r\nBody with *bold*, /italic/ and +strike+.\n** Second heading\n' + Array.from({ length: 90 }, (_, i) => `Paragraph ${i}: ` + 'soft wrapped text '.repeat(8)).join('\n') + '\n';
  await api('Save', { id: state.id, path, source: initial, revision: old?.revision || '' });
  await page.locator(`#tree [data-open="${path}"]`).click();
  await editor.waitFor({ state: 'visible' });
  assert.equal(await editor.getAttribute('spellcheck'), 'false');
  assert.equal(await page.locator('.topbar').count(), 0);
  assert.equal(await page.locator('.tab-strip #menu').count(), 1);
  assert.equal(await page.locator('.tab-strip #context-toggle').count(), 1);
  const style = await editor.evaluate(el => ({ base: getComputedStyle(el).fontSize, heading: getComputedStyle(el.querySelector('.org-h1')).fontSize, color: getComputedStyle(el.querySelector('.org-h1')).color, todo: getComputedStyle(el.querySelector('.org-todo')).color, bold: getComputedStyle(el.querySelector('.org-bold')).fontWeight, value: el.value }));
  assert.ok(parseFloat(style.heading) > parseFloat(style.base)); assert.notEqual(style.color, style.todo); assert.ok(Number(style.bold) >= 700);
  assert.match(style.value, /\* TODO Planning \*bold text\*/);

  await editor.locator('.editor-task-box').click(); await page.waitForFunction(() => document.getElementById('source')?.value.startsWith('* DONE ')); await saved();
  let note = await api('Read', { id: state.id, path });
  assert.match(note.source, /^\* DONE Planning/); assert.ok(note.source.includes('\r\nSCHEDULED:'));
  await page.locator('#ribbon [data-view="calendar"]').click();
  await page.locator('.calendar-event.completed', { hasText: 'Planning' }).waitFor();
  assert.equal(await page.locator('.calendar-event.completed', { hasText: 'Planning' }).evaluate(el => getComputedStyle(el).textDecorationLine), 'line-through');
  await page.locator('[data-calendar="day"]').click();
  const block = page.locator('.time-block', { hasText: 'Planning' });
  assert.equal(await block.evaluate(el => el.style.height), '90px');
  assert.equal(await block.evaluate(el => el.style.top), '540px');
  await page.locator('#ribbon [data-view="tags"]').click();
  assert.equal(await page.locator('#tags p.muted').count(), 0);
  await page.keyboard.press('Meta+2'); await editor.waitFor({ state: 'visible' });
  await editor.locator('.editor-task-box').click(); await page.waitForFunction(() => document.getElementById('source')?.value.startsWith('* TODO ')); await saved();
  await editor.evaluate(el => { el.focus(); el.setSelectionRange(8, 8); });
  await page.keyboard.press('Alt+t');
  await page.locator('#modal').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#modal [name="title"]').inputValue(), 'Planning *bold text*');
  assert.equal(await page.locator('#modal input[type="date"]').count(), 0);
  await page.locator('#modal [name="title"]').fill('Rescheduled *bold text*');
  await page.locator('#modal [name="time"]').fill('13:00');
  await page.locator('#modal [name="endTime"]').fill('14:15');
  await page.locator('#modal-submit').click(); await page.waitForFunction(() => document.getElementById('source')?.value.includes('Rescheduled')); await saved();
  note = await api('Read', { id: state.id, path });
  assert.match(note.source, /^\* TODO Rescheduled \*bold text\* :work:/);
  assert.ok(note.source.includes('SCHEDULED: <2026-09-26 13:00-14:15>'));
  assert.equal((note.source.match(/^\* /gm) || []).length, 1);
  assert.ok(note.source.endsWith(initial.slice(initial.indexOf('Body with'))));

  await page.locator('#ribbon [data-view="settings"]').click(); await page.locator('#vi-mode').check();
  await page.locator(`[data-tab-select="file:${path}"]`).click();
  await editor.evaluate(el => { el.focus(); el.setSelectionRange(0, 0); el.reveal(); });
  const before = await editor.evaluate(el => el.selectionStart);
  await page.keyboard.press('Control+d');
  const down = await editor.evaluate(el => el.selectionStart); assert.ok(down > before);
  await page.keyboard.press('Control+u'); assert.ok(await editor.evaluate(el => el.selectionStart) < down);
  await page.keyboard.type('ggi'); await page.keyboard.type('test-undo'); await page.keyboard.press('Escape'); await page.keyboard.type('u');
  assert.doesNotMatch(await editor.evaluate(el => el.value), /test-undo/);
  await page.locator('#ribbon [data-view="settings"]').click(); await page.locator('#vi-mode').uncheck();

  await page.locator('#ribbon [data-view="calendar"]').click();
  await page.locator('.time-slot[data-time="15:00"]').click();
  await page.locator('#modal [name="title"]').fill('Created in time grid');
  await page.locator('#modal [name="path"]').fill(path);
  assert.equal(await page.locator('#modal [name="time"]').inputValue(), '15:00');
  await page.locator('#modal [name="endTime"]').fill('16:00');
  await page.locator('#modal-submit').click();
  await page.locator('.timed-event', { hasText: 'Created in time grid' }).waitFor();
  await page.locator(`[data-tab-select="file:${path}"]`).click();
  await editor.evaluate(el => { el.setSelectionRange(0, 0); el.reveal(); });
  await page.waitForFunction(() => document.getElementById('source')?.querySelectorAll('.cm-line').length > 12);
  assert.deepEqual(errors, []);
  if (process.env.SCREENSHOT) {
    await page.screenshot({ path: process.env.SCREENSHOT });
  }
  console.log('PASS: formatted source, TODO-only color, task checkbox, completed calendar, timed blocks, selected-heading task modal, custom date picker, vi half-page motion/undo, tab shortcuts, shared tab bar.');
} catch (error) { console.error('Page errors:', errors); throw error; }
finally { await browser.close(); }
