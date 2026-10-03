// Run app/dev against a disposable workspace; creates vi-review-*.org fixtures.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const base = process.env.BASE_URL || 'http://127.0.0.1:9266';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
let page;
const errors = [];
const api = async (method, args = {}) => {
  const response = await page.request.post(base + '/api', { data: { method, ...args } });
  assert.ok(response.ok(), await response.text()); return response.json();
};
let serial = 0, editor, note, path;
const keys = text => page.keyboard.type(text);
const value = () => editor.evaluate(el => el.value);
const pos = () => editor.evaluate(el => el.selectionStart);
async function setup(text, vi = true) {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
  const state = await api('Status'); path = `vi-review-${++serial}.org`;
  const prior = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  await api('Save', { id: state.id, path, source: text, revision: prior?.revision || '' });
  await page.addInitScript(({ key, path, vi }) => {
    localStorage.setItem('org-vi-mode', String(vi));
    localStorage.setItem('org-right-sidebar', 'closed');
    localStorage.setItem('org-left-sidebar', 'closed');
    localStorage.setItem('org-layout-' + key, JSON.stringify({ tree: { id: 'vi-review', tabs: ['file:' + path], active: 'file:' + path }, focused: 'vi-review', modes: { [path]: 'edit' } }));
  }, { key: state.key, path, vi });
  await page.goto(base);
  note = page.locator(`.ui-document[data-path="${path}"]`); editor = note.locator('[data-ui="source"]');
  await editor.waitFor(); await editor.evaluate(el => { el.focus(); el.setSelectionRange(0, 0); });
}
const searchField = name => note.locator(`.note-search [name="${name}"]`);
try {
  const foldedText = '* Start\n* Folded\n' + 'hidden\n'.repeat(100) + '* After\none\ntwo\nTARGET\nlast\n';
  await setup(foldedText);
  await editor.evaluate(el => el.setHeadingFolds([el.value.indexOf('* Folded')]));
  await keys('105j'); assert.equal(await pos(), foldedText.indexOf('TARGET'));
  await keys('105k'); assert.equal(await pos(), 0);
  assert.equal((await editor.evaluate(el => el.getHeadingFolds())).length, 1);
  await keys('jgj'); assert.equal(await pos(), foldedText.indexOf('* After'));
  console.log('PASS counted source-line motions across folds and visible-row gj');

  await setup('one two three four five six seven eight\n');
  await keys('2d3w'); assert.equal(await value(), 'seven eight\n');
  await keys('u'); assert.equal(await value(), 'one two three four five six seven eight\n');
  await page.keyboard.press('Control+r'); assert.equal(await value(), 'seven eight\n');
  await keys('u'); await keys('ciw'); await keys('new'); await page.keyboard.press('Escape');
  await keys('w.'); assert.equal(await value(), 'new new three four five six seven eight\n');
  console.log('PASS counts, undo/redo, text objects, dot-repeat with inserted text');

  await setup('say "hello world" then (outer (inner) end)\n');
  await keys('f"ci"'); await keys('goodbye'); await page.keyboard.press('Escape');
  assert.equal(await value(), 'say "goodbye" then (outer (inner) end)\n');
  await keys('f(di('); assert.equal(await value(), 'say "goodbye" then ()\n');
  await keys('u0ft;'); assert.equal((await value())[await pos()], 't');
  await keys('0f";'); assert.equal(await pos(), 12);
  await keys(','); assert.equal(await pos(), 4);
  console.log('PASS quoted/nested text objects and repeated character finds');

  await setup('alpha\nbeta\ngamma\ndelta\n');
  await keys('Vjd'); assert.equal(await value(), 'gamma\ndelta\n');
  await keys('P'); assert.equal(await value(), 'alpha\nbeta\ngamma\ndelta\n');
  await keys('ggJ'); assert.equal(await value(), 'alpha beta\ngamma\ndelta\n');
  await keys('0rX'); assert.equal(await value(), 'Xlpha beta\ngamma\ndelta\n');
  await keys('Rabc'); await page.keyboard.press('Escape');
  assert.equal(await value(), 'abcha beta\ngamma\ndelta\n');
  console.log('PASS linewise selection/paste, join, single and continuous replacement');

  await setup('one\ntwo\nthree\nfour\nfive\n');
  await keys('qa'); assert.match(await note.locator('.cm-vim-panel').innerText(), /recording @a/);
  await keys('I! '); await page.keyboard.press('Escape'); await keys('jq');
  await keys('@a@@2@a');
  assert.equal(await value(), '! one\n! two\n! three\n! four\n! five\n');
  console.log('PASS record, replay, repeat-last macro, counted macro replay');

  await setup('* Parent\nBody\n** Child\nChild body\n* Other\nOther body\n');
  await keys('zc'); assert.ok(await note.locator('.cm-foldPlaceholder').first().isVisible());
  await keys('zo'); assert.equal(await note.locator('.cm-foldPlaceholder').count(), 0);
  await keys('zM'); assert.ok(await note.locator('.cm-foldPlaceholder').count() > 0);
  await keys('zR'); assert.equal(await note.locator('.cm-foldPlaceholder').count(), 0);
  await keys('/Child'); await page.keyboard.press('Enter');
  assert.equal(await pos(), 17);
  await keys('n'); assert.equal(await pos(), 23);
  await keys('N'); assert.equal(await pos(), 17);
  console.log('PASS Org folding and bottom Vim search with n/N');

  // The richer bar also works while the Vim adapter is active.
  await editor.evaluate(el => el.openSearch());
  await searchField('find').fill('Other'); await searchField('next').click();
  await searchField('replace').fill('Another');
  await searchField('replace-one').click();
  assert.match(await value(), /\* Another/);
  await searchField('close').click(); await page.keyboard.press('Escape');
  await keys('u'); assert.match(await value(), /\* Other/);
  await page.locator('#ribbon [data-view="settings"]').click(); await page.locator('#vi-mode').uncheck();
  await page.locator(`[data-tab-select="file:${path}"]`).click();
  await editor.evaluate(el => { el.focus(); el.setSelectionRange(0, 0); });
  await keys('j'); assert.ok((await value()).startsWith('j* Parent'));
  assert.equal(await note.locator('.cm-vimCursorLayer').count(), 0);
  console.log('PASS search/replace with Vim enabled, undo, disabling Vim and ordinary typing');

  await setup('cat1\r\n#+UNKNOWN: opaque\ncat2\rcat3\r\n', false);
  await editor.evaluate(el => el.openSearch());
  await searchField('find').fill('cat(\\d)'); await searchField('regex').check();
  await searchField('replace').fill('dog$1');
  await searchField('replace-all').click();
  assert.equal(await value(), 'dog1\n#+UNKNOWN: opaque\ndog2\ndog3\n');
  await note.locator('.ui-save-state').filter({ hasText: 'Saved to disk' }).waitFor();
  const state = await api('Status'), saved = await api('Read', { id: state.id, path });
  assert.equal(saved.source, 'dog1\r\n#+UNKNOWN: opaque\ndog2\rdog3\r\n');
  await searchField('close').click(); await editor.evaluate(el => el.undo());
  assert.equal(await value(), 'cat1\n#+UNKNOWN: opaque\ncat2\ncat3\n');
  console.log('PASS capture replacement, single-step undo, and byte-preserving multi-range saves');

  await setup('cat1 cat2 cat3\n', false);
  await editor.evaluate(el => { el.setSelectionRange(5, 9); el.openSearch(); });
  await searchField('selection').check(); await searchField('find').fill('cat(\\d)');
  await searchField('regex').check(); await searchField('replace').fill('long-dog$1');
  await searchField('replace-all').click(); assert.equal(await value(), 'cat1 long-dog2 cat3\n');
  await searchField('find').fill('long-dog(\\d)'); await searchField('replace').fill('x$1');
  await searchField('replace-all').click(); assert.equal(await value(), 'cat1 x2 cat3\n');
  await searchField('find').fill('[');
  assert.equal(await searchField('find').getAttribute('aria-invalid'), 'true');
  assert.ok(await searchField('replace-all').isDisabled());
  await searchField('find').fill('cat'); assert.equal(await note.locator('.note-search output').textContent(), '0 matches');
  await searchField('selection').uncheck(); assert.equal(await note.locator('.note-search output').textContent(), '2 matches');
  await page.setViewportSize({ width: 412, height: 860 });
  await page.waitForFunction(() => document.querySelector('.note-search').getBoundingClientRect().width < 412);
  assert.ok(await note.locator('.note-search').evaluate(el => el.scrollWidth <= el.clientWidth));
  console.log('PASS stable selection scope across edits, invalid regex, mobile panel fit');

  await setup('Alpha alpha alphabet\nAlpha\n', false);
  await editor.evaluate(el => el.openSearch());
  await searchField('find').fill('alpha'); await searchField('word').check();
  assert.equal(await note.locator('.note-search output').textContent(), '3 matches');
  await searchField('case').check(); assert.equal(await note.locator('.note-search output').textContent(), '1 matches');
  await searchField('word').uncheck(); await searchField('regex').check();
  await searchField('find').fill('^'); await searchField('replace').fill('> ');
  await searchField('replace-all').click(); assert.equal(await value(), '> Alpha alpha alphabet\n> Alpha\n> ');
  console.log('PASS case/word controls and zero-width regex replacement');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
