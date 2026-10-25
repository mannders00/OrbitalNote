// Run against a disposable app/dev workspace.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const base = process.env.BASE_URL || 'http://127.0.0.1:9250';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  await page.goto(base);
  await page.locator('#ribbon [data-view="agenda"]').click();
  await page.locator('#capture').click();
  const placement = page.locator('.task-insertion .task-segmented'), planning = page.locator('.task-planning');
  const a = await placement.boundingBox(), b = await planning.boundingBox();
  assert.equal(a.height, b.height, 'Both segmented controls use the same geometry');
  assert(b.x - a.x - a.width >= 24 || b.y - a.y - a.height >= 24, 'Placement and planning have a semantic gap');
  for (const [width, height] of [[1366, 768], [1280, 720], [1024, 640]]) {
    await page.setViewportSize({ width, height });
    assert(await page.locator('#modal-body').evaluate(el => el.scrollHeight <= el.clientHeight + 1), `Task form fits ${width}×${height} without scrolling`);
    const submit = await page.locator('#modal-submit').boundingBox();
    assert(submit.y + submit.height <= height, 'Primary action remains visible');
  }
  assert(await page.locator('.task-date-picker').isVisible(), 'Calendar is always visible');
  const calendarBounds = await page.locator('.task-date-picker').boundingBox();
  const planningBounds = await planning.boundingBox();
  assert(calendarBounds.y < planningBounds.y, 'Calendar leads the right column');
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole('radio', { name: 'Prepend', exact: true }).check();
  await page.getByRole('radio', { name: 'Deadline', exact: true }).check();
  assert(await page.getByRole('radio', { name: 'Prepend', exact: true }).isChecked());
  const input = page.locator('#modal input[name="path"]');
  await input.click();
  const list = page.locator('#' + await input.getAttribute('aria-controls'));
  assert(await list.evaluate(el => el.matches(':popover-open')), 'Dropdown uses the top layer');
  // Seed extra options in this isolated browser to exercise a long menu without
  // creating dozens of workspace files. Keyboard checks use the real options.
  const modal = page.locator('#modal-body');
  const initial = await modal.evaluate(el => el.scrollTop);
  for (let i = 0; i < 35; i++) await input.press('ArrowDown');
  assert.equal(await modal.evaluate(el => el.scrollTop), initial, 'Keyboard selection only scrolls the list');
  await list.evaluate(el => {
    for (let i = 0; i < 40; i++) { const row = document.createElement('div'); row.setAttribute('role', 'option'); row.textContent = 'Scroll boundary example ' + i; el.append(row); }
    el.scrollTop = el.scrollHeight;
  });
  const popup = await list.boundingBox(), dialog = await page.locator('#modal').boundingBox();
  assert(popup.y + popup.height > dialog.y + dialog.height, 'Long dropdown can extend beyond the modal');
  assert(await page.evaluate(({x,y,id}) => document.getElementById(id).contains(document.elementFromPoint(x,y)), {x:popup.x+20,y:popup.y+popup.height-10,id:await list.getAttribute('id')}), 'Dropdown remains hit-testable outside modal bounds');
  await list.hover();
  await page.mouse.wheel(0, 700); await page.waitForTimeout(250);
  await page.mouse.wheel(0, 700); await page.waitForTimeout(250);
  assert.equal(await modal.evaluate(el => el.scrollTop), initial, 'Bottom boundary contains wheel scrolling');
  await list.evaluate(el => { el.scrollTop = 0; });
  await page.mouse.wheel(0, -700); await page.waitForTimeout(250);
  assert.equal(await modal.evaluate(el => el.scrollTop), initial, 'Top boundary contains wheel scrolling');
  await input.press('Escape');
  assert(await list.isHidden());
  await page.locator('.date-picker-grid [data-date]').nth(12).click();
  assert(await page.locator('#modal input[name="date"]').inputValue(), 'Calendar selection updates the date');
  await page.setViewportSize({width:390,height:700});
  const mobileSubmit = await page.locator('#modal-submit').boundingBox();
  assert(mobileSubmit.y + mobileSubmit.height <= 700, 'Mobile actions remain visible while the body scrolls');
  await input.click();
  const mobilePopup = await list.boundingBox();
  assert(mobilePopup.x >= 0 && mobilePopup.x + mobilePopup.width <= 390 && mobilePopup.y >= 0 && mobilePopup.y + mobilePopup.height <= 700, 'Dropdown stays inside the mobile viewport');
  await list.locator('[role="option"]').first().click();
  assert(await list.isHidden(), 'Selecting a portaled option closes the list');
  await page.setViewportSize({width:1280,height:720});
  await page.screenshot({path:join(tmpdir(), 'orbitalnote-task-modal-polish.png')});
  await page.locator('#modal .modal-actions button[value="cancel"]').click();
  await page.waitForFunction(() => !document.querySelector('.task-file-options'));
  assert.equal(await page.locator('.task-file-options').count(), 0, 'Closing the modal cleans up the overlays');
  console.log('PASS matching task toggles, semantic spacing, independent selections, and contained dropdown keyboard/wheel scrolling.');
} finally { await browser.close(); }
