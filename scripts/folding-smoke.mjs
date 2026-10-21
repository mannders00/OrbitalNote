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

  const mixedPath = 'mixed-folding-smoke.org';
  const mixed = '* Mixed parent\r\n- [ ] Checklist parent\r\n  - [ ] Checklist child\r\n    - [ ] Checklist leaf\r\n- Bullet parent\r\n  - Bullet child\r\n    - Bullet leaf\r\n** Nested heading\r\n- [ ] Inner list\r\n  - Inner leaf\r\n* Outside\r\nOutside body\r\n';
  const priorMixed = (await api('Status')).files.some(file => file.path === mixedPath) ? await api('Read', { id: state.id, path: mixedPath }) : null;
  await api('Save', { id: state.id, path: mixedPath, source: mixed, revision: priorMixed?.revision || '' });
  await page.locator(`#tree [data-open="${mixedPath}"]`).click();
  const mixedNote = page.locator(`.ui-document[data-path="${mixedPath}"]`), mixedEditor = mixedNote.locator('.ui-source'), preview = mixedNote.locator('.ui-preview');
  const foldState = () => mixedEditor.evaluate(el => ({ headings: el.getHeadingFolds(), lists: el.listRanges().filter(item => item.folded).map(item => item.title) }));
  const buttonFor = (container, name) => container.getByRole('button', { name, exact: true });
  const moveAway = async () => { await page.mouse.move(2, 2); };
  const opacity = async (button, expected) => {
    await page.waitForFunction(({ selector, expected }) => {
      const button = document.querySelector(selector);
      return button && Math.abs(Number(getComputedStyle(button).opacity) - expected) < .01;
    }, { selector: await button.evaluate(el => { el.dataset.opacityProbe = 'true'; return '[data-opacity-probe="true"]'; }), expected });
    await button.evaluate(el => delete el.dataset.opacityProbe);
  };
  const aligned = async button => {
    const geometry = await button.evaluate(el => {
      const row = el.closest('.cm-line, .preview-list-label'), walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      let text;
      while (walker.nextNode()) if (walker.currentNode.textContent.trim() && !walker.currentNode.parentElement.closest('button')) { text = walker.currentNode; break; }
      const range = document.createRange(); const offset = text.textContent.search(/\S/); range.setStart(text, offset); range.setEnd(text, offset + 1);
      const glyph = range.getBoundingClientRect(), icon = el.querySelector('svg').getBoundingClientRect();
      return { glyphY: (glyph.top + glyph.bottom) / 2, iconY: (icon.top + icon.bottom) / 2 };
    });
    assert.ok(Math.abs(geometry.glyphY - geometry.iconY) < 5, JSON.stringify(geometry));
  };
  const sourceParent = buttonFor(mixedEditor, 'Collapse list item: [ ] Checklist parent');
  await moveAway(); await opacity(sourceParent, 0);
  await mixedEditor.locator('.org-list-fold-line').filter({ hasText: 'Checklist parent' }).hover();
  await opacity(sourceParent, 1); await aligned(sourceParent);
  await sourceParent.click({ modifiers: ['Meta'] });
  assert.deepEqual((await foldState()).lists, ['[ ] Checklist parent', '[ ] Checklist child']);
  await buttonFor(mixedEditor, 'Expand list item: [ ] Checklist parent').click();
  assert.deepEqual((await foldState()).lists, ['[ ] Checklist child'], 'ordinary expand retains child folds');
  await sourceParent.click();
  await buttonFor(mixedEditor, 'Expand list item: [ ] Checklist parent').dispatchEvent('click', { metaKey: true });
  assert.deepEqual((await foldState()).lists, []);
  const sourceChild = buttonFor(mixedEditor, 'Collapse list item: [ ] Checklist child');
  await mixedEditor.locator('.org-list-fold-line').filter({ hasText: 'Checklist child' }).hover();
  await opacity(sourceChild, 1); await opacity(sourceParent, 0); await aligned(sourceChild);
  await aligned(buttonFor(mixedEditor, 'Collapse list item: Bullet parent'));

  await buttonFor(mixedEditor, 'Collapse heading: Mixed parent').click({ modifiers: ['Meta'] });
  assert.equal((await foldState()).headings.length, 2, JSON.stringify(await foldState()));
  assert.equal((await foldState()).lists.length, 5, 'recursive heading fold includes all nested lists');
  assert.match(await mixedEditor.innerText(), /Outside body/);
  await buttonFor(mixedEditor, 'Expand heading: Mixed parent').click({ modifiers: ['Meta'] });
  assert.deepEqual(await foldState(), { headings: [], lists: [] });

  await mixedNote.locator('.ui-preview-toggle').click();
  const previewParent = buttonFor(preview, 'Collapse list item: [ ] Checklist parent');
  await moveAway(); await opacity(previewParent, 0);
  await previewParent.locator('xpath=ancestor::*[contains(@class,"preview-list-label")]').hover();
  await opacity(previewParent, 1); await aligned(previewParent);
  await previewParent.dispatchEvent('click', { metaKey: true });
  assert.deepEqual((await foldState()).lists, ['[ ] Checklist parent', '[ ] Checklist child']);
  const foldedLabel = preview.locator('.preview-list-label.is-folded').filter({ hasText: 'Checklist parent' });
  assert.match(await foldedLabel.evaluate(el => getComputedStyle(el, '::after').content), /…/);
  assert.ok(await preview.getByText('Checklist leaf', { exact: true }).isHidden());
  await buttonFor(preview, 'Expand list item: [ ] Checklist parent').click({ modifiers: ['Meta'] });
  assert.deepEqual((await foldState()).lists, []);
  const previewChild = buttonFor(preview, 'Collapse list item: [ ] Checklist child');
  await previewChild.locator('xpath=ancestor::*[contains(@class,"preview-list-label")]').hover();
  await opacity(previewChild, 1); await opacity(previewParent, 0); await aligned(previewChild);
  await aligned(buttonFor(preview, 'Collapse list item: Bullet parent'));
  await buttonFor(preview, 'Collapse heading: Mixed parent').dispatchEvent('click', { metaKey: true });
  assert.equal((await foldState()).lists.length, 5);
  await buttonFor(preview, 'Expand heading: Mixed parent').click({ modifiers: ['Meta'] });
  assert.deepEqual(await foldState(), { headings: [], lists: [] });
  await mixedNote.locator('.ui-preview-toggle').click();
  assert.match(await mixedEditor.innerText(), /Checklist leaf|Bullet leaf|Inner leaf/);
  assert.equal((await api('Read', { id: state.id, path: mixedPath })).source, mixed);
  assert.deepEqual(errors, []);
  console.log('PASS: heading/list folds, hover visibility, vertical alignment, preview ellipses, Cmd/Ctrl recursive folding, mode synchronization, and unchanged CRLF source.');
} finally { await browser.close(); }
