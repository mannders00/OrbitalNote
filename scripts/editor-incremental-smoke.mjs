import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = process.env.BASE_URL || 'http://127.0.0.1:9295';
  const api = async (method, q = {}) => { const r = await page.request.post(base + '/api', { data: { method, ...q } }); assert.ok(r.ok(), await r.text()); return r.json(); };
  const status = await api('Status'), path = 'incremental-highlighting.org';
  const old = status.files.some(f => f.path === path) ? await api('Read', { id: status.id, path }) : null;
  await api('Save', { id: status.id, path, revision: old?.revision || '', source: '* First\nPlain *bold* and [[file:other.org][link]].\n- [ ] Check me\n#+begin_src text\nLiteral *stars*\n#+end_src\n* Second\n:PROPERTIES:\n:ID: second\n:END:\nSecond body\n** Child\nChild body\n' });
  await page.goto(base); await page.locator(`#tree [data-open="${path}"]`).click();
  const editor = page.locator('#source');
  const snapshot = () => editor.evaluate(el => [...el.querySelectorAll('.cm-line')].map(line => ({ text: line.textContent, class: line.className, marks: [...line.querySelectorAll('span:not(.editor-heading-control), [data-task-line], [data-checkbox-line]')].map(mark => [mark.className, mark.textContent]) })));
  for (const [find, replacement] of [['Plain', 'More /italic/'], ['*bold*', 'unmarked'], ['Check me', '*Checked words*'], ['Literal', 'Still literal'], ['Second body', 'Expanded body with ~code~']]) {
    await editor.evaluate((el, [find, replacement]) => { const at = el.value.indexOf(find); el.replaceText(replacement, at, at + find.length); }, [find, replacement]);
    const incremental = await snapshot();
    await editor.evaluate(el => { el.value = el.value; });
    assert.deepEqual(await snapshot(), incremental, `incremental rendering differs from full parse after ${find}`);
  }
  // Move all following source offsets without adding lines, then click the old
  // widget DOM: it must resolve the current heading rather than a stale span.
  await editor.evaluate(el => { const at = el.value.indexOf('More'); el.replaceText('Longer prefix ', at, at); });
  await editor.getByRole('button', { name: 'Collapse heading: Second', exact: true }).click();
  assert.ok(await editor.evaluate(el => el.getHeadingFolds().includes(el.value.indexOf('* Second'))));
  await editor.getByRole('button', { name: 'Expand heading: Second', exact: true }).click();
  const row = editor.locator('.cm-line').filter({ hasText: '* Second' });
  await row.hover(); await row.getByRole('button', { name: 'Heading actions', exact: true }).click();
  await page.getByRole('dialog', { name: 'Heading actions', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  console.log('PASS incremental styles match full parsing; mapped heading controls retain current source coordinates');
} finally { await browser.close(); }
