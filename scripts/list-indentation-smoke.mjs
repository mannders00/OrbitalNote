// Run against app/dev with a disposable workspace.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium' });
const base = process.env.BASE_URL || 'http://127.0.0.1:9245';
try {
  for (const touch of [false, true]) {
    const page = await browser.newPage({ viewport: { width: touch ? 390 : 1440, height: 1000 }, hasTouch: touch, isMobile: touch });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    const api = async (method, args = {}) => {
      const response = await page.request.post(base + '/api', { data: { method, ...args } });
      assert(response.ok(), await response.text()); return response.json();
    };
    const { id, files } = await api('Status'), path = 'list-indentation.org';
    const source = '- one\n  - two\n- three\n  - four\n- five\n\n- [ ] parent\n  - [ ] child\n- [ ] sibling\n\n1. first\n   1. nested\n2. last\n';
    const old = files.some(file => file.path === path) ? await api('Read', { id, path }) : null;
    await api('Save', { id, path, source, revision: old?.revision || '' });
    await page.reload();
    // The file picker works with both desktop and collapsed mobile sidebars.
    await page.keyboard.press('ControlOrMeta+o');
    await page.locator('#palette-input').fill(path);
    await page.keyboard.press('Enter');
    await page.locator('#source').waitFor();
    const positions = mode => page.locator(mode === 'source' ? '#source' : '#preview').evaluate((root, mode) => {
      const labels = ['one', 'two', 'three', 'four', 'five', 'parent', 'child', 'sibling', 'first', 'nested', 'last'];
      return Object.fromEntries(labels.map(label => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
          if (node.parentElement.closest('button')) continue;
          const at = node.textContent.indexOf(label);
          if (at < 0) continue;
          const range = document.createRange(); range.setStart(node, at); range.setEnd(node, at + label.length);
          return [label, range.getBoundingClientRect().x];
        }
        throw new Error(`Missing ${mode} label: ${label}`);
      }));
    }, mode);
    const check = p => {
      for (const [a, b] of [['one', 'three'], ['one', 'five'], ['two', 'four'], ['parent', 'sibling'], ['first', 'last']]) assert(Math.abs(p[a] - p[b]) < 1, `${a}/${b} align: ${JSON.stringify(p)}`);
      for (const [a, b] of [['one', 'two'], ['three', 'four'], ['parent', 'child'], ['first', 'nested']]) assert(p[b] > p[a] + 5, `${b} is indented after ${a}: ${JSON.stringify(p)}`);
    };
    for (const mode of ['source', 'preview']) {
      if (mode === 'preview') await page.keyboard.press('ControlOrMeta+e');
      const root = page.locator(mode === 'source' ? '#source' : '#preview');
      await root.waitFor({ state: 'visible' });
      const before = await positions(mode); check(before);
      const line = root.locator(mode === 'source' ? '.org-list-fold-line' : '.preview-list-label').first();
      if (mode === 'source') {
        await root.evaluate(el => { el.setSelectionRange(el.value.indexOf('- five'), el.value.indexOf('- five')); el.focus(); });
        if (!touch) await line.hover();
        assert.equal(await line.locator('.editor-list-fold').evaluate(el => getComputedStyle(el).pointerEvents), 'none', 'Inactive source controls stay hidden even on hover');
        await root.evaluate(el => { el.setSelectionRange(0, 0); el.focus(); });
      } else if (touch) await line.tap(); else await line.hover();
      assert.deepEqual(await positions(mode), before, `${mode}: revealing controls does not shift text`);
      const fold = root.locator(mode === 'source' ? '.editor-list-fold' : '.preview-list-fold').first();
      await fold.click();
      assert.equal(await fold.getAttribute('aria-expanded'), 'false');
      await fold.click();
      assert.equal(await fold.getAttribute('aria-expanded'), 'true');
      assert.deepEqual(await positions(mode), before, `${mode}: folding and expanding preserves indentation`);
      assert.equal(await page.locator('#source').evaluate(el => el.value), source);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: nested bullets, checklists and numbered lists align in source/preview on desktop/touch; controls and folding do not shift text or change source.');
} finally { await browser.close(); }
