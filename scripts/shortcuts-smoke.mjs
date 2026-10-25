// Real app UI against app/dev with a disposable workspace.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // Observe dispatch to the native zoom bridge without needing a native window.
  await page.route('**/api.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/export async function zoomNative\(direction\) \{[^\n]+\}/, 'export async function zoomNative(direction) { (window.zoomCalls ||= []).push(direction); }');
    await route.fulfill({response, body});
  });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:9240');
  await page.locator('#ribbon [data-view="agenda"]').click();
  await page.locator('#capture').click();
  await page.locator('#modal [name="title"]').fill('Zoom should preserve this');
  for (const key of ['ControlOrMeta+=', 'ControlOrMeta+-', 'ControlOrMeta+0', 'ControlOrMeta+Shift+=']) await page.keyboard.press(key);
  assert.deepEqual(await page.evaluate(() => window.zoomCalls), [1, -1, 0, 1]);
  assert.equal(await page.locator('#modal [name="title"]').inputValue(), 'Zoom should preserve this');
  await page.keyboard.press('ControlOrMeta+p');
  assert.ok(!(await page.locator('#palette').evaluate(el => el.open)), 'Other app shortcuts remain blocked in the modal');
  await page.locator('#modal .modal-actions button[value="cancel"]').click();
  await page.waitForFunction(() => !document.querySelector('#modal').open);
  await page.keyboard.press('ControlOrMeta+,');
  await page.locator('#keyboard-settings').waitFor({ state: 'visible' });
  await page.keyboard.press('ControlOrMeta+p');
  assert.ok(await page.locator('#palette').evaluate(el => el.open));
  assert.equal(await page.locator('#palette-input').getAttribute('placeholder'), 'Find a command…');
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+o');
  assert.equal(await page.locator('#palette-input').getAttribute('placeholder'), 'Open a file…');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Change shortcut: Find file by name', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+p');
  assert.match(await page.locator('[data-shortcut-message]').textContent(), /Already assigned to Run command/);
  assert.ok(!(await page.locator('#palette').evaluate(el => el.open)));
  await page.keyboard.press('ControlOrMeta+k');
  assert.match(await page.locator('[data-shortcut-message]').textContent(), /Shortcut saved/);
  await page.keyboard.press('ControlOrMeta+k');
  assert.equal(await page.locator('#palette-input').getAttribute('placeholder'), 'Open a file…');
  assert.ok(await page.locator('#palette').evaluate(el => el.open));
  await page.keyboard.press('Escape');
  // Dispatch avoids the browser's own Open File dialog when testing an unbound key.
  const prevented = await page.evaluate(() => !document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', metaKey: true, bubbles: true, cancelable: true })));
  assert.equal(prevented, false);
  await page.reload();
  await page.keyboard.press('ControlOrMeta+k');
  assert.ok(await page.locator('#palette').evaluate(el => el.open));
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+,');
  await page.getByRole('button', { name: 'Clear shortcut: Find file by name', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Change shortcut: Find file by name', exact: true }).textContent(), 'Not assigned');
  await page.getByRole('button', { name: 'Restore default shortcuts', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+o');
  assert.ok(await page.locator('#palette').evaluate(el => el.open));
  assert.deepEqual(errors, []);
  console.log('PASS: requested shortcut defaults, remapping, conflict detection, persistence, clear and reset.');
} finally { await browser.close(); }
