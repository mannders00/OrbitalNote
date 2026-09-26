// Run against a disposable dev workspace on :9240, with Playwright available.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless:true, args:['--no-sandbox'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
try {
  await page.clock.setFixedTime(new Date(2026,8,24,12));
  await page.goto('http://127.0.0.1:9240');
  await page.locator('#agenda').waitFor({state:'visible'});
  await page.evaluate(async () => {
    const api = async (method,q={}) => (await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,...q})})).json();
    const s = await api('Status');
    await api('Mkdir',{id:s.id,path:'tag-moves'});
    await api('Save',{id:s.id,path:'tag-colors.org',revision:'',source:'#+FILETAGS: :fallback:\n* TODO Specific :specific:\nSCHEDULED: <2026-09-24 Thu>\n* TODO Fallback\nSCHEDULED: <2026-09-24 Thu>\n'});
  });
  await page.locator('#tree [data-open="tag-colors.org"]').waitFor();
  await page.locator('[data-view="tags"]').click();
  await page.locator('[data-color-name="specific"][data-color="#cd879b"]').click();
  await page.locator('[data-color-name="fallback"][data-color="#66bcb3"]').click();
  await page.reload(); await page.locator('#tags').waitFor({state:'visible'});
  await page.locator('[data-view="agenda"]').click();
  assert.match(await page.locator('.agenda-entry[data-color-tag="specific"]').getAttribute('style'), /#cd879b/);
  assert.match(await page.locator('.agenda-entry[data-color-tag="fallback"]').getAttribute('style'), /#66bcb3/);
  await page.locator('[data-view="calendar"]').click();
  assert.match(await page.locator('.calendar-event[data-color-tag="specific"]').getAttribute('style'), /#cd879b/);
  assert.match(await page.locator('.calendar-event[data-color-tag="fallback"]').getAttribute('style'), /#66bcb3/);
  await page.locator('#tree [data-open="tag-colors.org"]').click();
  const original = await page.locator('#source').evaluate(el => el.value);
  await page.locator('#source').fill(original + '\nUnsaved move test\n');
  await page.locator('#tree [data-open="tag-colors.org"]').dragTo(page.locator('[data-drop-folder="tag-moves"]'));
  await page.locator('[data-tab-select="file:tag-moves/tag-colors.org"]').waitFor();
  assert.match(await page.locator('#source').evaluate(el => el.value), /Unsaved move test/);
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => document.getElementById('save-state').textContent === 'Saved to disk');
  const moved = await page.evaluate(async () => {
    const api = async (method,q={}) => (await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,...q})})).json();
    const s = await api('Status'); return {files:s.files, note:await api('Read',{id:s.id,path:'tag-moves/tag-colors.org'})};
  });
  assert.ok(!moved.files.some(f=>f.path==='tag-colors.org'));
  assert.match(moved.note.source,/Unsaved move test/);
  await page.locator('#tree [data-open="tag-moves/tag-colors.org"]').dragTo(page.locator('[data-drop-folder=""]'));
  await page.locator('[data-tab-select="file:tag-colors.org"]').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: file tags, palette persistence, heading precedence, calendar colors, file drag to folder/root, unsaved tab retargeting and save.');
} finally { await browser.close(); }
