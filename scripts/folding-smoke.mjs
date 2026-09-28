// Serve app/dev with a disposable workspace. Override BASE_URL if needed.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const base = process.env.BASE_URL || 'http://127.0.0.1:9240';
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const api = async (method, q = {}) => {
    const r = await page.request.post(base + '/api', { data: { method, ...q } });
    assert.ok(r.ok(), await r.text()); return r.json();
  };
  await page.goto(base);
  const state = await api('Status'), path = 'folding-smoke.org';
  const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  const source = '* Parent\r\nParent body\r\n** Child\r\nChild body\r\n* Sibling\r\nSibling body\r\n#+begin_src org\r\n* Not a heading\r\n#+end_src\r\n';
  const saved = await api('Save', { id: state.id, path, source, revision: old?.revision || '' });
  await page.locator(`#tree [data-open="${path}"]`).click();
  const note = page.locator(`.ui-document[data-path="${path}"]`);
  const editor = note.locator('.ui-source');
  await note.getByRole('button', { name: 'Collapse heading: Parent', exact: true }).click();
  assert.equal(await editor.locator('.cm-foldPlaceholder').count(), 1);
  assert.doesNotMatch(await editor.innerText(), /Parent body|Child body/);
  assert.match(await editor.innerText(), /Sibling body/);
  await note.getByRole('button', { name: 'Expand heading: Parent', exact: true }).click();
  assert.match(await editor.innerText(), /Child body/);
  assert.equal(await editor.locator('.editor-heading-fold').count(), 3);
  const palette = async title => {
    await page.locator('#palette-button').click();
    await page.locator('#palette-input').fill(title);
    await page.locator('#palette-results button').filter({ hasText: title }).first().click();
  };
  await palette('Fold all headings');
  assert.doesNotMatch(await editor.innerText(), /Parent body|Child body|Sibling body/);
  await palette('Unfold all headings');
  assert.match(await editor.innerText(), /Sibling body/);
  await editor.evaluate(el => el.setSelectionRange(0, 0));
  await palette('Toggle heading folding');
  assert.doesNotMatch(await editor.innerText(), /Parent body/);
  await palette('Toggle heading folding');
  assert.match(await editor.innerText(), /Parent body/);
  await note.locator('.ui-preview-toggle').click();
  await note.locator('.ui-preview').getByRole('button', { name: 'Collapse heading: Parent', exact: true }).click();
  assert.ok(await note.locator('.ui-preview p').filter({ hasText: 'Child body' }).isHidden());
  await palette('Unfold all headings');
  assert.ok(await note.locator('.ui-preview p').filter({ hasText: 'Child body' }).isVisible());
  const sidebar = note.locator('.ui-context');
  if (!(await sidebar.isVisible())) await page.locator('#context-toggle').click();
  const side = await sidebar.boundingBox(), toggle = await note.locator('.ui-preview-toggle').boundingBox();
  assert.ok(toggle.x + toggle.width <= side.x, 'Reading/edit controls must stay left of expanded sidebar');
  const after = await api('Read', { id: state.id, path });
  assert.equal(after.source, source); assert.equal(after.revision, saved.revision);
  assert.deepEqual(errors, []);
  console.log('PASS: nested heading folds, palette commands, preview folding, source/CRLF preservation and sidebar toolbar geometry.');
} finally { await browser.close(); }
