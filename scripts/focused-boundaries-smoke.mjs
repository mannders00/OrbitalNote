// Run against a disposable app/dev workspace.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:9243';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const api = async (method, data = {}) => { const r = await page.request.post(base + '/api', { data: { method, ...data } }); assert(r.ok()); return r.json(); };
  const state = await api('Status'), path = 'focused-boundaries.org';
  const source = '* Before\nOutside before\n* Focus\n- [ ] Parent\n  - [ ] Child\n    - [ ] Leaf\nLast visible line\n* After\nOutside after\n';
  const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  await api('Save', { id: state.id, path, source, revision: old?.revision || '' });
  await page.addInitScript(({key,path}) => {
    localStorage.setItem('org-vi-mode', 'true');
    localStorage.setItem('org-layout-' + key, JSON.stringify({tree:{id:'one',tabs:['file:'+path],active:'file:'+path},focused:'one'}));
  }, {key:state.key,path});
  await page.goto(base); const editor = page.locator('#source'); await editor.waitFor();
  await editor.evaluate(el => { const text=el.value; el.setFocusRange({from:text.indexOf('* Focus'),to:text.indexOf('\n* After')}); el.focus(); });
  await page.keyboard.press('G');
  const pos = () => editor.evaluate(el => ({cursor:el.cursorPosition(),selection:el.selectionStart,range:el.getFocusRange(),text:el.value}));
  assert.equal((await pos()).cursor.column, 1, 'G lands at the visible last line, not hidden EOF');
  await page.keyboard.press('0');
  await page.keyboard.press('j');
  const afterDown = await pos();
  assert.equal(afterDown.cursor.column, 1, 'Moving down at the focused end keeps the current column');
  await page.keyboard.press('o');
  assert.equal((await pos()).cursor.column, 1, 'New focused final line has a real caret position');
  await page.keyboard.type('New final line'); await page.keyboard.press('Escape');
  assert.match((await pos()).text, /Last visible line\nNew final line\n\* After/);
  await page.keyboard.type('dd');
  assert.equal((await pos()).text, source, 'dd removes the final focused line, including its preceding separator');
  const deletedPosition = (await pos()).cursor;
  await page.keyboard.press('j');
  assert.deepEqual((await pos()).cursor, deletedPosition, 'j cannot return to the deleted final line');
  await page.keyboard.press('p');
  assert.equal((await pos()).text, source.replace('Last visible line\n', 'Last visible line\nNew final line\n'), 'Deleted line stays in the linewise register');
  await page.keyboard.press('u');
  assert.equal((await pos()).text, source, 'Undo paste restores the focused boundary');
  await page.keyboard.press('G'); await page.keyboard.press('o'); await page.keyboard.press('Escape');
  await page.keyboard.type('dd');
  assert.equal((await pos()).text, source, 'dd also removes an empty final line');
  await page.keyboard.press('G'); await page.keyboard.type('k2dd');
  assert.equal((await pos()).text, source.replace('    - [ ] Leaf\nLast visible line\n', ''), 'Counted deletion removes whole final lines without touching the next heading');
  await page.keyboard.press('u');
  assert.equal((await pos()).text, source, 'Undo restores both deleted lines and the focused range');
  await page.keyboard.type('gg');
  assert.equal((await pos()).selection, (await pos()).range.from, 'gg stays at the focused root');
  await page.keyboard.press('G'); await page.keyboard.type('99j');
  assert((await pos()).selection <= (await pos()).range.to);
  for (const fixture of [
    { text: '* Parent\nBody\n** Child\nChild body\n* After\nOutside\n', start: 0, at: '\n* After', expected: '* Parent\nBody\n** Child\nChild body\nNew line\n* After\nOutside\n' },
    { text: '* Parent\n- [ ] List\n  - Child\n- Next\n', start: 9, at: '\n- Next', expected: '* Parent\n- [ ] List\n  - Child\nNew line\n- Next\n' },
    { text: '* Parent\nBody\n** Child\nChild body\n* After\nOutside\n', start: 0, focused: true, expected: '* Parent\nBody\n** Child\nChild body\nNew line\n* After\nOutside\n' },
  ]) {
    await editor.evaluate((el, fixture) => { el.setFocusRange(null); el.value = fixture.text; if (fixture.focused) el.setFocusRange({ from: 0, to: fixture.text.indexOf('\n* After') }); el.foldAt(fixture.start, true, true); el.setSelectionRange(fixture.start, fixture.start); el.focus(); }, fixture);
    await page.keyboard.press('o'); await page.keyboard.type('New line'); await page.keyboard.press('Escape');
    assert.equal((await pos()).text, fixture.expected, 'o inserts after the entire folded subtree');
    assert.match(await editor.innerText(), /New line/, 'The inserted line is visible');
    assert.doesNotMatch(await editor.innerText(), /Child body|  - Child/, 'Folded content stays hidden');
    const closed = await editor.evaluate((el, start) => el.getHeadingFolds().includes(start) || el.listRanges().some(item => item.start === start && item.folded), fixture.start);
    assert(closed, 'The original fold remains closed');
  }
  assert.deepEqual(errors, []);
  console.log('PASS focused Vim end navigation, append, dd/j, blank-line deletion, counted deletes, registers, and undo preserve surrounding source.');
} finally { await browser.close(); }
