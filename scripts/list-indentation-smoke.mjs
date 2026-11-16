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
    const source = 'Paragraph\n\n- one\n  - two\n- three\n  - four\n- five\n\n- [ ] parent\n  - [ ] child\n- [ ] sibling\n\n1. first\n   1. nested\n2. last\n\n- solo\n';
    const old = files.some(file => file.path === path) ? await api('Read', { id, path }) : null;
    await api('Save', { id, path, source, revision: old?.revision || '' });
    await page.reload();
    // The file picker works with both desktop and collapsed mobile sidebars.
    await page.keyboard.press('ControlOrMeta+o');
    await page.locator('#palette-input').fill(path);
    await page.keyboard.press('Enter');
    await page.locator('#source').waitFor();
    const positions = mode => page.locator(mode === 'source' ? '#source' : '#preview').evaluate((root, mode) => {
      const labels = ['Paragraph', 'one', 'two', 'three', 'four', 'five', 'parent', 'child', 'sibling', 'first', 'nested', 'last', 'solo'];
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
      if (mode === 'source') await root.evaluate(el => { el.setSelectionRange(0, 0); el.focus(); });
      const before = await positions(mode); check(before);
      if (mode === 'source') {
        const bullets = await root.evaluate(el => [...el.querySelectorAll('.cm-line')].filter(line => /^- (one|five|solo)$/.test(line.textContent)).map(line => {
          const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT); let node;
          while (node = walker.nextNode()) if (node.textContent.startsWith('- ')) {
            const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 1); return range.getBoundingClientRect().x;
          }
        }));
        assert.equal(bullets.length, 3);
        for (const x of bullets) assert(Math.abs(x - before.Paragraph) < 1, 'Inactive bullets align with paragraph source, without a reserved gutter');
      } else {
        assert.equal(await root.locator('ul').first().evaluate(el => getComputedStyle(el).marginLeft), '0px', 'Preview has no permanent fold gutter');
      }
      const line = root.locator(mode === 'source' ? '.org-list-fold-line' : '.preview-list-label').first();
      if (mode === 'source') {
        await root.evaluate(el => { el.setSelectionRange(el.value.indexOf('- five'), el.value.indexOf('- five')); el.focus(); });
        await page.mouse.move(0, 0);
        const control = line.locator('.editor-list-fold');
        assert.equal(await control.evaluate(el => getComputedStyle(el).pointerEvents), 'none', 'Inactive source controls stay hidden');
        if (touch) {
          await root.evaluate(el => { const at = el.value.indexOf('- one'); el.setSelectionRange(at, at); el.focus(); });
        } else {
          await root.evaluate(el => { const at = el.value.indexOf('- one'); el.setSelectionRange(at, at); el.focus(); });
          assert.equal(await control.evaluate(el => getComputedStyle(el).pointerEvents), 'none', 'Desktop cursor placement alone does not reveal controls');
          await root.evaluate(el => { const at = el.value.indexOf('- five'); el.setSelectionRange(at, at); el.focus(); });
          await line.hover();
        }
        assert.equal(await control.evaluate(el => getComputedStyle(el).pointerEvents), 'auto', touch ? 'Touch cursor reveals controls' : 'Desktop hover reveals controls without moving the cursor');
      } else if (touch) await line.tap(); else await line.hover();
      const active = await positions(mode);
      for (const label of Object.keys(before)) assert(Math.abs(active[label] - before[label] - (touch && ['one', 'two'].includes(label) ? 26 : 0)) < 1, `${mode}: only the active mobile subtree shifts (${label})`);
      const fold = root.locator(mode === 'source' ? '.editor-list-fold' : '.preview-list-fold').first();
      await fold.click();
      assert.equal(await fold.getAttribute('aria-expanded'), 'false');
      await fold.click();
      assert.equal(await fold.getAttribute('aria-expanded'), 'true');
      assert.deepEqual(await positions(mode), active, `${mode}: folding and expanding preserves indentation`);
      if (!touch) {
        await fold.focus();
        await page.mouse.move(0, 0);
        assert.equal(await fold.evaluate(el => getComputedStyle(el).pointerEvents), 'auto', 'Keyboard focus retains controls after the pointer leaves');
        await root.evaluate(el => el.focus());
        assert.equal(await fold.evaluate(el => getComputedStyle(el).pointerEvents), 'none', 'Controls hide when hover and button focus leave');
      }
      if (mode === 'source') await root.evaluate(el => { const at = el.value.indexOf('- solo'); el.setSelectionRange(at, at); el.focus(); });
      else if (touch) await root.getByText('Paragraph', { exact: true }).tap();
      else await page.mouse.move(0, 0);
      assert.deepEqual(await positions(mode), before, `${mode}: leaving the item restores normal indentation; a leaf needs no space`);
      for (const [label, child] of [['parent', 'child'], ['first', 'nested']]) {
        if (mode === 'source') await root.evaluate((el, label) => { const at = el.value.indexOf(label); el.setSelectionRange(at, at); el.focus(); }, label);
        else {
          const target = root.locator('.preview-list-label').filter({ hasText: new RegExp(`\\b${label}\\b`) });
          if (touch) await target.tap(); else await target.hover();
        }
        const shifted = await positions(mode);
        for (const key of Object.keys(before)) assert(Math.abs(shifted[key] - before[key] - (touch && [label, child].includes(key) ? 26 : 0)) < 1, `${mode}: ${label} and its child shift together, without moving siblings`);
      }
      if (mode === 'source') await root.evaluate(el => { el.setSelectionRange(0, 0); el.focus(); });
      assert.equal(await page.locator('#source').evaluate(el => el.value), source);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
   console.log('PASS: no permanent list gutter; desktop margin controls; mobile active-subtree shifting and restoration; folding and source preservation.');
} finally { await browser.close(); }
