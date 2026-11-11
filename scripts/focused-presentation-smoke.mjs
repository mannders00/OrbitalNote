// Uses the disposable WASM demo by default; also works with an app/dev workspace.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:9271');
  const api = (method, q = {}) => page.evaluate(async ({ method, q }) => {
    const response = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, ...q }) });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }, { method, q });
  const state = await api('Status'), path = 'Focus presentation.org';
  const text = '* Parent\nOutside parent\n** TODO Focus root\n:PROPERTIES:\n:NOTE: visible root metadata\n:END:\nRoot body\n- Parent item\n  - Nested item\n*** Closed child\nHidden child body\n**** Grandchild\nHidden grandchild body\n*** Open child\nVisible child body\n* After\nOutside after\n';
  const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  await api('Save', { id: state.id, path, source: process.env.PLAIN_HEADING ? text.replace('TODO Focus root', 'Focus root') : text, revision: old?.revision || '' });
  await page.locator(`#tree [data-open="${path}"]`).click();
  const original = page.locator(`.ui-document[data-view-id="file:${path}"] .ui-source`);
  await original.waitFor();
  await original.evaluate(el => {
    el.setMetadataFolds([]);
    el.foldAt(el.value.indexOf('*** Closed child'), true, true);
    el.foldAt(el.value.indexOf('* After'), true);
    el.foldAt(el.value.indexOf('- Parent item'), true);
    const at = el.value.indexOf('** '); el.setSelectionRange(at, at);
  });
  const folds = await original.evaluate(el => el.getFoldRanges());
  const rootLine = original.locator('.cm-line').filter({ hasText: 'Focus root' });
  const style = await rootLine.evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight }));
  await rootLine.hover();
  await rootLine.locator('.heading-menu-button').click();
  await page.getByRole('button', { name: 'Focus on heading', exact: true }).click();
  const focused = page.locator('#source');
  assert(await focused.evaluate(el => !!el.getFocusRange()));
  assert.deepEqual(await focused.evaluate(el => el.getFoldRanges()), folds, 'Focused copy inherits heading, nested, list and metadata folds');
  const heading = focused.locator('.cm-line').filter({ hasText: 'Focus root' });
  assert(await heading.evaluate(el => el.classList.contains('org-h2')), 'Focused root keeps its original heading level');
  assert.deepEqual(await heading.evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight })), style);
  await heading.hover();
  assert(await heading.locator('.heading-menu-button').isVisible());
  assert(await heading.locator('.editor-heading-fold').isVisible());
  const checkControlAlignment = async root => {
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(1, 1);
    const gutter = await root.locator('.heading-menu-button').boundingBox();
    // Enter the gap beside the hidden menu directly, without crossing heading text.
    await page.mouse.move(gutter.x + gutter.width + 1, gutter.y + gutter.height / 2);
    await page.waitForFunction(() => [...document.querySelectorAll('.heading-menu-button')].some(el => el.closest('.org-heading, [data-source-heading]')?.matches(':hover') && getComputedStyle(el).opacity === '1'));
    const centers = await root.evaluate(el => [...el.querySelectorAll('.heading-menu-button svg, .editor-heading-fold svg, .preview-heading-fold svg')].map(icon => {
      const r = icon.getBoundingClientRect(); return r.top + r.height / 2;
    }));
    assert.equal(centers.length, 2);
    assert(Math.abs(centers[0] - centers[1]) < 1, 'Heading menu and fold icons share the first-line center');
    const contained = await root.evaluate(el => {
      const pane = el.closest('.source-pane, .ui-preview').getBoundingClientRect();
      return [...el.querySelectorAll('.heading-menu-button, .editor-heading-fold, .preview-heading-fold')].every(button => {
        const r = button.getBoundingClientRect();
        return r.left >= pane.left && r.right <= pane.right;
      });
    });
    assert(contained, 'Both heading controls fit inside the pane rather than being clipped by its scroll viewport');
    await root.locator('.heading-menu-button').click();
    await page.getByRole('button', { name: 'Focus on heading', exact: true }).waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await checkControlAlignment(heading);
  await page.setViewportSize({ width: 1300, height: 950 });
  assert.match(await focused.innerText(), /Visible child body/);
  assert.doesNotMatch(await focused.innerText(), /Outside parent|Outside after|Hidden child body|Hidden grandchild body|Nested item/);
  await heading.locator('.editor-heading-fold').click();
  assert.doesNotMatch(await focused.innerText(), /Root body/);
  await heading.locator('.cm-foldPlaceholder').click();
  assert.deepEqual(await focused.evaluate(el => el.getFoldRanges()), folds, 'Clicking the focused root ellipsis expands it and retains descendant folds');
  assert.deepEqual(await original.evaluate(el => el.getFoldRanges()), folds, 'Original view is untouched');
  await page.locator('#preview-toggle').click();
  const preview = page.locator('#preview');
  assert.match(await preview.innerText(), /Visible child body/);
  assert.doesNotMatch(await preview.innerText(), /Hidden child body|Nested item|Outside parent|Outside after/);
  const previewRoot = preview.locator('[data-source-heading]').filter({ hasText: 'Focus root' });
  assert(await previewRoot.locator('.preview-heading-fold').isVisible());
  await page.setViewportSize({ width: 390, height: 844 });
  await previewRoot.click({ position: { x: 110, y: 10 } });
  await checkControlAlignment(previewRoot);
  await page.setViewportSize({ width: 1300, height: 950 });
  await previewRoot.locator('.preview-heading-fold').click();
  assert.doesNotMatch(await preview.innerText(), /Root body/);
  await previewRoot.locator('.preview-heading-ellipsis').click();
  assert.match(await preview.innerText(), /Root body/);
  assert.deepEqual(await focused.evaluate(el => el.getFoldRanges()), folds, 'Reading-view root ellipsis expands only its own fold');
  await page.getByRole('button', { name: 'Show whole file', exact: true }).click();
  assert.deepEqual(await focused.evaluate(el => el.getFoldRanges()), folds, 'Leaving focus retains the inherited folds');

  // Enclosing folds must not swallow a root when a saved/nested focus opens.
  await page.locator('#preview-toggle').click();
  await focused.evaluate(el => {
    el.foldAt(0, true);
    el.setFocusRange({ from: el.value.indexOf('** '), to: el.value.indexOf('\n* After') });
  });
  assert.match(await focused.innerText(), /Focus root/);
  assert.deepEqual(await focused.evaluate(el => el.getFoldRanges()), folds, 'Only an enclosing fold is revealed');
  // Hidden preceding folds share the focused root's visual line block.
  // Clicking its marker must not expand a different, invisible heading.
  await focused.evaluate(el => {
    el.setFocusRange(null);
    el.value = '* Before\nHidden body\n* Focus\nRoot body\n** Child\nChild body\n* After\nAfter body';
    el.foldHeading('fold-all');
    el.setFocusRange({ from: el.value.indexOf('* Focus'), to: el.value.indexOf('\n* After') });
  });
  const allFolds = await focused.evaluate(el => el.getFoldRanges());
  const rootFold = await focused.evaluate(el => el.value.indexOf('\nRoot body'));
  await focused.locator('.cm-foldPlaceholder').click();
  assert.deepEqual(await focused.evaluate(el => el.getFoldRanges()), allFolds.filter(fold => fold.from !== rootFold), 'The clicked root expands, leaving hidden preceding and nested folds intact');
  assert.match(await focused.innerText(), /Root body/);
  assert.deepEqual(errors, []);
  console.log(`PASS (${engine.name()}): focused root styling/controls, inherited mixed folds, nested fold retention, preview parity, and enclosing-fold reveal.`);
} finally { await browser.close(); }
