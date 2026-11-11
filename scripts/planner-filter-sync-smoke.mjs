// Run against a disposable app/dev workspace. Checks the actual shared pickers.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = process.env.BASE_URL || 'http://127.0.0.1:9257';
  await page.goto(base);
  const open = async view => {
    await page.locator(`#ribbon [data-view="${view}"]`).click();
    const root = page.locator('#' + view);
    if (!await root.locator('details.agenda-query-builder').evaluate(el => el.open)) await root.locator('summary').click();
    await root.locator('.query-popup').waitFor({ state: 'visible' });
    return root;
  };
  const choose = async (root, selector, value) => {
    const label = await root.locator(selector).evaluate((el, value) => [...el.options].find(o => o.value === value).textContent, value);
    const input = root.locator(`${selector} + .task-file-picker input`);
    await input.fill(label);
    await page.locator('#' + await input.getAttribute('aria-controls')).getByRole('option', { name: label, exact: true }).click();
  };
  const equal = async (count, active) => {
    for (const view of ['agenda', 'calendar']) {
      const root = page.locator('#' + view);
      assert.equal(await root.locator('[data-rule-count]').textContent(), count ? String(count) : '');
      assert.equal(await root.locator('[data-saved-view]').inputValue(), active);
    }
  };
  for (const [from, to] of [['agenda', 'calendar'], ['calendar', 'agenda']]) {
    let root = await open(from);
    assert(await root.locator('[data-quick-view] + .task-file-picker').isHidden(), 'No inactive shortcut occupies the toolbar');
    assert(await root.locator('.query-view-section [data-saved-view] + .task-file-picker').isVisible(), 'The view selector is always available inside Filters');
    await choose(root, '[data-query-field]', 'type');
    await choose(root, '[data-query-value]', 'scheduled');
    await root.locator('[data-query-add]').click();
    await equal(1, '');
    root = await open(from);
    await root.locator('[data-view-name]').fill('Shared review');
    await root.locator('[data-save-view]').click();
    await equal(1, 'Shared review');
    assert(await root.locator('[data-quick-view] + .task-file-picker').isVisible(), 'Active filters expose the toolbar shortcut');
    await root.getByRole('button', { name: 'Clear active filters', exact: true }).click();
    await equal(0, '');
    assert(await root.locator('[data-quick-view] + .task-file-picker').isHidden(), 'Clearing removes the toolbar shortcut');
    assert.equal(await page.locator('[data-saved-view] option[value="Shared review"]').count(), 2, 'Clearing disables the view without deleting it');
    await choose(root, '[data-saved-view]', 'Shared review');
    await equal(1, 'Shared review');
    root = await open(to);
    await choose(root, '[data-query-mode]', 'any');
    assert.equal(await page.locator('#' + from + ' [data-query-mode]').inputValue(), 'any');
    assert.equal(await page.locator('#' + from + ' [data-query-mode] + .task-file-picker input').inputValue(), 'any filter');
    await root.locator('[data-query-clear]').click();
    await equal(0, 'Shared review');
    await root.locator('[data-save-view]').click();
    await page.reload(); await equal(0, 'Shared review');
    root = await open(from);
    await root.locator('[data-delete-view]').click();
    await equal(0, '');
    assert.equal(await page.locator('[data-saved-view] option[value="Shared review"]').count(), 0);
    await page.reload(); await equal(0, '');
  }
  assert.deepEqual(errors, []);
  console.log(`PASS (${engine.name()}): live rules, match mode, saved-view creation/edit/deletion, picker labels, and reload persistence synchronize both ways.`);
} finally { await browser.close(); }
