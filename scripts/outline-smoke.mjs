// Run app/dev against a disposable workspace. Regression for GitHub issue #60.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const base = process.env.BASE_URL || 'http://127.0.0.1:9276';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const api = async (method, data = {}) => {
    const response = await page.request.post(base + '/api', { data: { method, ...data } });
    assert.ok(response.ok(), await response.text()); return response.json();
  };
  const state = await api('Status'), path = 'untitled-headings.org';
  const old = state.files.some(file => file.path === path) ? await api('Read', { id: state.id, path }) : null;
  const source = '* Before\r\n** \r\nBody\r\n*** Child\r\nChild body\r\n* \r\n* After\r\nAfter body\r\n';
  await api('Save', { id: state.id, path, source, revision: old?.revision || '' });
  await page.goto(base);
  await page.locator(`#tree [data-open="${path}"]`).click();
  const note = page.locator(`.ui-document[data-path="${path}"]`), editor = note.locator('.ui-source'), outline = note.locator('[data-ui="outline"]');
  await note.waitFor({ state: 'visible' });
  await outline.locator('[data-jump="1"]').waitFor({ state: 'attached' });
  if (!await outline.isVisible()) await page.locator('#context-toggle').click();
  assert.deepEqual(await outline.locator('[data-jump]').allTextContents(), ['Before', 'Untitled heading', 'Child', 'Untitled heading', 'After']);
  assert.equal(await outline.locator('details[data-heading="2"] > details[data-heading="4"]').count(), 1);
  for (const line of [2, 6, 7]) {
    await outline.locator(`[data-jump="${line}"]`).click();
    assert.equal(await editor.evaluate(el => el.cursorPosition().line), line);
  }
  // Delete a title while editing, then put it back. Neither transition may clear
  // the other headings or alter the underlying newline representation.
  await editor.evaluate(el => { el.setSelectionRange(2, 8); el.focus(); });
  await page.keyboard.press('Backspace');
  await page.waitForFunction(() => document.querySelectorAll('.ui-document [data-ui="outline"] [data-jump]').length === 5 && [...document.querySelectorAll('.ui-document [data-ui="outline"] [data-jump]')].filter(el => el.textContent === 'Untitled heading').length === 3);
  await page.keyboard.insertText('Before');
  await page.waitForFunction(() => document.querySelector('.ui-document [data-ui="outline"] [data-jump="1"]')?.textContent === 'Before');
  await note.locator('.ui-preview-toggle').click();
  const rendered = await note.locator('.ui-preview [data-source-heading]').evaluateAll(nodes => nodes.map(el => Number(el.dataset.sourceHeading)));
  const normalized = source.replaceAll('\r\n', '\n');
  assert.deepEqual(rendered, [0, normalized.indexOf('** '), normalized.indexOf('*** Child'), normalized.indexOf('\n* \n') + 1, normalized.indexOf('* After')]);
  assert.equal((await api('Read', { id: state.id, path })).source, source);
  assert.deepEqual(errors, []);
  console.log('PASS: empty-heading outline labels, hierarchy, navigation, live title deletion/restoration, preview coordinates, and CRLF preservation (#60).');
} finally { await browser.close(); }
