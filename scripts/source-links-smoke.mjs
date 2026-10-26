// Run against app/dev with a disposable workspace.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/usr/bin/chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const base = process.env.BASE_URL || 'http://127.0.0.1:9240';
  await page.goto(base);
  const api = async (method, args = {}) => {
    const response = await page.request.post(base + '/api', { data: { method, ...args } });
    assert.ok(response.ok(), await response.text()); return response.json();
  };
  const { id } = await api('Status');
  const source = '* Links\nBefore [[file:link-target.org][Target note]] after.\nVisit [[https://example.com][Example]].\n#+begin_src org\n[[file:link-target.org][Literal example]]\n#+end_src\n';
  for (const [path, text] of [['source-links.org', source], ['link-target.org', '* Destination\nTarget body.\n']]) {
    const status = await api('Status');
    const old = status.files.some(file => file.path === path) ? await api('Read', { id, path }) : null;
    await api('Save', { id, path, source: text, revision: old?.revision || '' });
  }
  await page.reload();
  await page.locator('#tree [data-open="source-links.org"]').click();
  const editor = page.locator('#source');
  assert.ok((await editor.innerText()).includes('Before Target note after.'));
  assert.ok((await editor.innerText()).includes('[[file:link-target.org][Literal example]]'));
  await editor.locator('.org-link', { hasText: 'Target note' }).click();
  assert.ok((await editor.innerText()).includes('[[file:link-target.org][Target note]]'));
  await editor.evaluate(el => el.setSelectionRange(0, 0));
  assert.ok((await editor.innerText()).includes('Before Target note after.'));
  assert.equal(await editor.evaluate(el => el.value), source);
  await editor.evaluate(el => { const pos = el.value.indexOf('Target note'); el.setSelectionRange(pos, pos); el.focus(); });
  const count = await page.locator('[data-tab-select]').count();
  await page.keyboard.press('ControlOrMeta+Enter');
  await page.waitForFunction(() => document.querySelector('#document')?.dataset.path === 'link-target.org');
  assert.equal(await page.locator('[data-tab-select]').count(), count);
  assert.equal((await api('Read', { id, path: 'source-links.org' })).source, source);
  // Already-open destinations stay available while the originating slot is replaced.
  await page.locator('#tree [data-open="source-links.org"]').click();
  await page.waitForFunction(() => document.querySelector('#document')?.dataset.path === 'source-links.org');
  const secondCount = await page.locator('[data-tab-select]').count();
  await editor.locator('.org-link', { hasText: 'Target note' }).click({ modifiers: ['ControlOrMeta'] });
  await page.waitForFunction(() => document.querySelector('#document')?.dataset.path === 'link-target.org');
  await page.locator('[data-tab-select="file:source-links.org"]').waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-tab-select]').count(), secondCount, JSON.stringify(await page.locator('[data-tab-select]').evaluateAll(els => els.map(el => el.dataset.tabSelect))));
  assert.equal(await page.locator('.ui-document[data-path="link-target.org"]').count(), 2);
  await page.keyboard.press('ControlOrMeta+,');
  await page.getByRole('button', { name: 'Change shortcut: Open link at cursor', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+Shift+l');
  // This binding is occupied, so choose a free one.
  assert.match(await page.locator('[data-shortcut-message]').textContent(), /Already assigned/);
  await page.keyboard.press('ControlOrMeta+Shift+j');
  assert.match(await page.locator('[data-shortcut-message]').textContent(), /Shortcut saved/);
  assert.deepEqual(errors, []);
  console.log('PASS: source label collapse/reveal, literal code, unchanged text, keyboard and modifier-click navigation, same-tab replacement, existing destinations, configurable shortcut.');
} finally { await browser.close(); }
