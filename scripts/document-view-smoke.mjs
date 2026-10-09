// app/dev must use a disposable workspace. Verifies both presentations of one note.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const base = process.env.BASE_URL || 'http://127.0.0.1:9267';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const api = async (method, data = {}) => (await page.request.post(base + '/api', { data: { method, ...data } })).json();
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
try {
  const state = await api('Status'), path = 'view-sync.org';
  const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  const text = '* Parent\nParent text.\n** Child\nChild text.\n** Sibling\nSibling text.\n' + Array.from({ length: 24 }, (_, i) => `* Section ${i + 1}\nParagraph for section ${i + 1}. ${'Readable prose with *formatting* and ~code~. '.repeat(6)}\n\nAnother paragraph for section ${i + 1}.\n\n`).join('') + '* Final\nFinal body line.\n';
  const raw = text.replaceAll('\n', '\r\n');
  await api('Save', { id: state.id, path, source: raw, revision: old?.revision || '' });
  await page.addInitScript(({ key, path }) => {
    localStorage.setItem('org-left-sidebar', 'closed'); localStorage.setItem('org-right-sidebar', 'closed');
    localStorage.setItem('org-layout-' + key, JSON.stringify({ tree: { id: 'reading', tabs: ['file:' + path], active: 'file:' + path }, focused: 'reading' }));
  }, { key: state.key, path });
  await page.goto(base);
  const note = page.locator('.ui-document'), editor = note.locator('[data-ui="source"]'), preview = note.locator('.ui-preview');
  await editor.waitFor();
  const toggle = async () => { await note.locator('.ui-preview-toggle').click(); await settle(); };
  const folds = () => editor.evaluate(el => el.getHeadingFolds());
  const childStart = text.indexOf('** Child');
  await editor.evaluate((el, start) => el.setHeadingFolds([start]), childStart);
  await toggle();
  assert.equal(await preview.getByRole('button', { name: 'Expand heading: Child', exact: true }).count(), 1);
  await preview.getByRole('button', { name: 'Collapse heading: Parent', exact: true }).click();
  await toggle();
  assert.deepEqual(await folds(), [0, childStart]);
  await editor.evaluate(el => el.foldHeading('unfold'));
  await toggle();
  assert.ok(await preview.getByRole('button', { name: 'Expand heading: Child', exact: true }).isVisible());
  assert.ok(await preview.getByText('Sibling text.', { exact: true }).isVisible());
  await toggle();
  console.log('PASS bidirectional folds and retained nested folds');

  const target = text.indexOf('* Section 12');
  await editor.evaluate((el, pos) => { el.setHeadingFolds([]); el.jumpTo(pos); }, target); await settle();
  const before = await editor.evaluate(el => ({ scroll: el.scrollTop, start: el.selectionStart, end: el.selectionEnd }));
  await toggle();
  const bounds = await preview.boundingBox(), heading = await preview.getByRole('heading', { name: /Section 12/ }).boundingBox();
  assert.ok(heading && heading.y > bounds.y && heading.y < bounds.y + bounds.height, 'Same section stays in view');
  await toggle();
  const after = await editor.evaluate(el => ({ scroll: el.scrollTop, start: el.selectionStart, end: el.selectionEnd }));
  assert.ok(Math.abs(after.scroll - before.scroll) < 3, `${before.scroll} -> ${after.scroll}`);
  assert.equal(after.start, before.start); assert.equal(after.end, before.end);
  console.log('PASS exact edit/preview/edit viewport and cursor round trip');

  await toggle();
  await preview.getByRole('heading', { name: /Section 20/ }).evaluate(el => el.scrollIntoView({ block: 'start' })); await settle();
  const previewScroll = await preview.evaluate(el => el.scrollTop);
  await toggle();
  const readingPosition = await editor.evaluate(el => el.captureViewport().pos);
  assert.ok(readingPosition >= text.indexOf('* Section 20') - 5 && readingPosition < text.indexOf('* Section 21'), 'Reading scroll maps back to source');
  await toggle(); assert.ok(Math.abs(await preview.evaluate(el => el.scrollTop) - previewScroll) < 2, 'Exact preview/edit/preview round trip');
  await toggle();
  console.log('PASS preview scrolling transfers current reading position');

  await editor.evaluate(el => el.jumpTo(el.value.length)); await settle();
  const end = await editor.evaluate(el => { const caret = el.caretRect(), pane = el.viewport.getBoundingClientRect(); return { y: (caret.top + caret.bottom) / 2 - pane.top, height: pane.height }; });
  assert.ok(Math.abs(end.y - end.height / 2) < 35, JSON.stringify(end));
  await toggle(); await preview.evaluate(el => { el.scrollTop = el.scrollHeight; }); await settle();
  const tail = await preview.getByText('Final body line.', { exact: true }).boundingBox(), pane = await preview.boundingBox();
  assert.ok(Math.abs(tail.y + tail.height - pane.y - pane.height / 2) < 45);
  console.log('PASS trailing space and end-of-file cursor centering in both modes');

  for (const currentMode of ['preview', 'edit']) {
    await note.locator('.ui-file-actions').click(); await page.getByRole('button', { name: 'Fold all', exact: true }).click();
    assert.equal((await folds()).length, 28);
    await note.locator('.ui-file-actions').click(); await page.getByRole('button', { name: 'Unfold all', exact: true }).click();
    assert.deepEqual(await folds(), []);
    if (currentMode === 'preview') await toggle();
  }
  assert.equal((await api('Read', { id: state.id, path })).source, raw);
  await page.setViewportSize({ width: 412, height: 860 }); await settle();
  await editor.evaluate(el => el.jumpTo(el.value.length)); await settle();
  const mobileEnd = await editor.evaluate(el => { const caret = el.caretRect(), pane = el.viewport.getBoundingClientRect(); return { y: (caret.top + caret.bottom) / 2 - pane.top, height: pane.height }; });
  assert.ok(Math.abs(mobileEnd.y - mobileEnd.height / 2) < 35, JSON.stringify(mobileEnd));
  await toggle(); await toggle();
  console.log('PASS mobile tail sizing and mode switches');

  await editor.evaluate((el, childStart) => { el.setHeadingFolds([childStart]); el.replaceText('* Added\n\n', 0, 0); }, childStart);
  await toggle();
  await page.waitForFunction(start => document.querySelector(`[data-source-heading="${start}"] .preview-heading-fold`)?.getAttribute('aria-expanded') === 'false', childStart + '* Added\n\n'.length);
  await toggle(); assert.deepEqual(await folds(), [childStart + '* Added\n\n'.length]);
  console.log('PASS source edits before folded headings and asynchronous preview refresh');
  const metadataText = '* Parent\n:PROPERTIES:\n:ID: parent-id\n:END:\n:LOGBOOK:\nCLOCK: [2026-10-01 Thu 09:00]--[2026-10-01 Thu 09:30] => 0:30\n:END:\nParent text.\n';
  await editor.evaluate((el, text) => { el.replaceText(text, 0, el.value.length); el.setMetadataFolds(el.metadataRanges().map(range => range.start)); el.jumpTo(0); }, metadataText);
  await page.setViewportSize({ width: 1300, height: 900 }); await settle();
  assert.equal((await editor.evaluate(el => el.getMetadataFolds())).length, 2);
  await editor.getByRole('button', { name: 'Expand properties', exact: true }).last().click();
  assert.equal((await editor.evaluate(el => el.getMetadataFolds())).length, 1);
  await toggle();
  const properties = preview.locator('details').filter({ has: page.locator('summary', { hasText: 'Properties' }) });
  await properties.waitFor();
  assert.equal(await properties.evaluate(el => el.open), true);
  await properties.locator('summary').click();
  await toggle();
  assert.equal((await editor.evaluate(el => el.getMetadataFolds())).length, 2);
  await editor.getByRole('button', { name: 'Expand properties', exact: true }).last().click();
  await editor.getByRole('button', { name: 'Collapse properties', exact: true }).click();
  assert.equal((await editor.evaluate(el => el.getMetadataFolds())).length, 2);
  assert.equal(await editor.evaluate(el => el.value), metadataText);
  console.log('PASS source metadata controls and bidirectional Properties state');
  const largeText = Array.from({ length: 400 }, (_, i) => `* Heading ${i}\nBody ${i}\n** Child ${i}\nChild body\n`).join('');
  await editor.evaluate((el, text) => el.replaceText(text, 0, el.value.length), largeText);
  await toggle();
  await page.waitForFunction(() => document.querySelectorAll('.ui-preview .preview-heading-fold').length === 800);
  await editor.evaluate(el => {
    const original = el.setHeadingFolds;
    el.foldBatchCalls = 0;
    el.setHeadingFolds = (...args) => { el.foldBatchCalls++; return original(...args); };
  });
  for (const mode of ['preview', 'edit']) {
    for (const [label, count] of [['Fold all', 800], ['Unfold all', 0]]) {
      await note.locator('.ui-file-actions').click();
      const elapsed = await page.getByRole('button', { name: label, exact: true }).evaluate(button => { const start = performance.now(); button.click(); return performance.now() - start; });
      assert.ok(elapsed < 3000, `${mode} ${label} took ${elapsed}ms`);
      assert.equal((await folds()).length, count);
      console.log(`PASS ${mode} ${label}: 800 headings in ${Math.round(elapsed)}ms`);
    }
    if (mode === 'preview') await toggle();
  }
  assert.ok(await editor.evaluate(el => el.foldBatchCalls <= 2), 'Bulk folding must not rebuild folds once per heading');
  assert.equal(await editor.evaluate(el => el.value), largeText);
  assert.deepEqual(errors, []);
  console.log('PASS file-menu folding from either mode; source bytes unchanged');
} finally { await browser.close(); }
