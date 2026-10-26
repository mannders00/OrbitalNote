// Run against a disposable app/dev workspace.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:9244';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const api = async (method, data = {}) => { const r = await page.request.post(base + '/api', { data: { method, ...data } }); assert(r.ok()); return r.json(); };
  const state = await api('Status'), path = 'calendar-checklist-polish.org';
  const source = '* TODO Clocked work\nSCHEDULED: <2026-10-25 Sun>\n:LOGBOOK:\nCLOCK: [2026-10-25 Sun 09:00]\n:END:\n- [X] Checked parent\n  - [ ] Nested child\n    - [ ] Leaf\n* TODO Timed work\nSCHEDULED: <2026-10-25 Sun 10:00>\n';
  const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  await api('Save', { id: state.id, path, source, revision: old?.revision || '' });
  await page.clock.setFixedTime(new Date(2026, 9, 25, 12));
  await page.goto(base);
  await page.locator(`#tree [data-open="${path}"]`).click();
  const badge = page.locator('#source .heading-clock-status');
  await badge.waitFor();
  assert(await badge.evaluate(el => {
    const line = el.closest('.cm-line').getBoundingClientRect(), status = el.getBoundingClientRect();
    return status.top < line.top + line.height / 2;
  }), 'Clock status stays inline with its heading');
  assert.equal(await page.locator('#source').evaluate(el => el.value), source, 'Clock badge is not note content');
  await page.locator('#preview-toggle').click();
  const checked = page.locator('#preview .preview-list-fold').first();
  await checked.waitFor();
  const result = await page.locator('#document').evaluate(async surface => {
    const { createDocumentView } = await import('/document-view.js');
    const editor = surface.querySelector('.ui-source'), preview = surface.querySelector('.ui-preview');
    const before = editor.value;
    // Exercise the compact (no paragraph wrapper) list shape as well as the
    // loose nested-list shape covered by folding-smoke.
    const parent = preview.querySelector('li');
    const label = parent.querySelector(':scope > p > .preview-list-label');
    label?.querySelector('.preview-list-control')?.remove();
    if (label) label.replaceWith(...label.childNodes);
    const paragraph = parent.querySelector(':scope > p');
    if (paragraph) paragraph.replaceWith(...paragraph.childNodes);
    const view = createDocumentView(surface, editor);
    const outline = text => text.split('\n').flatMap((line, i) => line.startsWith('* ') ? [{ line: i + 1 }] : []);
    view.prepare(before, outline(before));
    // An invisible source change reuses preview HTML, including its checkbox
    // and folding controls. The source offsets must still be refreshed.
    const after = '# Comment\n' + before;
    editor.syncValue(after); view.prepare(after, outline(after));
    const button = preview.querySelector('.preview-list-fold');
    const actual = Number(button.dataset.listStart), expected = after.indexOf('- [X] Checked parent');
    button.click();
    const folded = editor.listRanges().find(item => item.start === expected)?.folded;
    const hidden = preview.querySelector('li ul').hidden;
    button.click();
    const expanded = !preview.querySelector('li ul').hidden;
    view.dispose();
    return { actual, expected, folded, hidden, expanded };
  });
  assert.equal(result.actual, result.expected, 'Checked checklist fold offsets refresh when preview HTML is reused');
  assert(result.folded && result.hidden && result.expanded, 'The first click folds and the second expands correctly');
  await page.locator('#ribbon [data-view="calendar"]').click();
  await page.locator('[data-calendar="week"]').click();
  const toggle = page.locator('[data-all-day-toggle]');
  await toggle.waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await toggle.click();
  assert(await page.locator('#calendar-all-day').isHidden());
  assert(await page.locator('.time-grid').isVisible());
  await page.locator('[data-calendar="day"]').click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await page.reload();
  await page.locator('#ribbon [data-view="calendar"]').click();
  await page.locator('[data-calendar="week"]').click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'All-day preference survives reload');
  await toggle.click();
  assert(await page.locator('#calendar-all-day').isVisible());
  assert.deepEqual(errors, []);
  console.log('PASS checked-list first-toggle rendering after reused HTML; persistent day/week all-day collapse.');
} finally { await browser.close(); }
