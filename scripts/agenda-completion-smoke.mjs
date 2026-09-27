// Run against app/dev on :9240 with a disposable workspace.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage();
  const api = async (method, q = {}) => {
    const response = await page.request.post('http://127.0.0.1:9240/api', { data: { method, ...q } });
    assert.ok(response.ok(), await response.text()); return response.json();
  };
  await page.goto('http://127.0.0.1:9240');
  const { id } = await api('Status'), path = 'completion.org';
  const source = '#+TODO: NEXT WAIT | FINISHED\r\n* NEXT Complete from agenda\r\nBody stays untouched.\r\n';
  const existing = await api('Status');
  const revision = existing.files.some(f => f.path === path) ? (await api('Read', { id, path })).revision : '';
  await api('Save', { id, path, source, revision });
  await page.locator('[data-filter="all"]').click();
  await page.getByRole('button', { name: 'Mark Complete from agenda as done', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('Task completed'));
  assert.equal((await api('Read', { id, path })).source, source.replace('* NEXT', '* FINISHED'));
  assert.equal(await page.getByRole('button', { name: 'Mark Complete from agenda as done', exact: true }).count(), 0);
  await page.locator(`#tree [data-open="${path}"]`).click();
  await page.locator(`[data-tab-select="file:${path}"]`).waitFor();
  await page.keyboard.press('Meta+w');
  await page.locator(`[data-tab-select="file:${path}"]`).waitFor({ state: 'detached' });
  assert.ok(!page.isClosed());
  console.log('PASS: agenda completion honors custom done states and CRLF; Cmd+W closes the active tab.');
} finally { await browser.close(); }
