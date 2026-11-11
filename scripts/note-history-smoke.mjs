import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (process.env.DEBUG_HISTORY) { page.on('console', m => console.log(m.type(), m.text())); page.on('pageerror', e => console.log(e.stack)); }
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:9271');
  const api = (method, q = {}) => page.evaluate(async ({ method, q }) => {
    const r = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, ...q }) });
    if (!r.ok) throw new Error(await r.text()); return r.json();
  }, { method, q });
  const state = await api('Status');
  for (const [path, source] of Object.entries({
    'History A.org': '* Start\n[[file:History%20B.org][Go to B]]\n** Fold me\nHidden body\n',
    'History B.org': '* Second\n[[file:History%20C.org][Go to C]]\n',
    'History C.org': '* Third\nThe end\n',
  })) {
    const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
    await api('Save', { id: state.id, path, source, revision: old?.revision || '' });
  }
  const active = path => page.locator(`#document[data-path="${path}"][data-navigation-busy="false"]`).waitFor({ state: 'visible' });
  const picker = async path => { await page.locator('#quick-open').click(); await page.locator('#palette-input').fill(path); if (process.env.DEBUG_HISTORY) console.log(await page.locator('#palette').innerHTML()); await page.locator('#palette-results button').first().click(); await active(path); };
  await page.locator('#tree [data-open="History A.org"]').click(); await active('History A.org');
  assert(await page.locator('#note-back').isDisabled());
  assert(await page.locator('#note-forward').isDisabled());
  await page.locator('#source').evaluate(el => el.foldAt(el.value.indexOf('** Fold me'), true));
  await page.locator('#preview-toggle').click();
  await page.locator('#preview').getByRole('link', { name: 'Go to B' }).click(); await active('History B.org');
  assert(await page.locator('#note-back').isEnabled());
  await picker('History C.org');
  await page.locator('#note-back').click(); await active('History B.org');
  assert(await page.locator('#note-forward').isEnabled());
  await page.locator('#note-back').click(); await active('History A.org');
  assert(await page.locator('#note-back').isDisabled());
  assert.equal(await page.locator('#panes').getAttribute('data-mode'), 'preview');
  assert.doesNotMatch(await page.locator('#preview').innerText(), /Hidden body/);
  await page.locator('#note-forward').click(); await active('History B.org');
  await picker('History A.org');
  assert(await page.locator('#note-forward').isDisabled(), 'New navigation drops the forward branch');
  const chainID = await page.locator('#document').getAttribute('data-view-id');

  // Opening an already-open target in a different tab must not inherit its stack.
  await page.locator('#ribbon [data-view="agenda"]').click();
  await page.getByRole('group', { name: 'Open task: Sketch the first version', exact: true }).click();
  await active('Launch.org'); assert(await page.locator('#note-back').isDisabled());
  const firstLaunch = await page.locator('#document').getAttribute('data-view-id');
  await picker('History B.org');
  const independent = await page.locator('#document').getAttribute('data-view-id');
  assert(await page.locator('#note-back').isEnabled());
  await page.locator('#ribbon [data-view="calendar"]').click();
  await page.locator('[data-calendar="day"]').click();
  await page.locator('#calendar [data-open="Launch.org"]').first().click();
  await active('Launch.org');
  assert(await page.locator('#note-back').isDisabled());
  assert.notEqual(await page.locator('#document').getAttribute('data-view-id'), independent);
  await page.locator('#ribbon [data-view="agenda"]').click();
  await page.getByRole('group', { name: 'Open task: Sketch the first version', exact: true }).click();
  await active('Launch.org');
  assert(await page.locator('#note-back').isDisabled());
  assert.notEqual(await page.locator('#document').getAttribute('data-view-id'), firstLaunch, 'Planner creates a new view even for an open file');
  await page.locator(`[data-tab-select="${independent}"]`).click(); await active('History B.org');
  assert(await page.locator('#note-back').isEnabled());
  await page.locator('#note-back').click(); await active('Launch.org');
  assert(await page.locator('#note-forward').isEnabled());
  await page.locator(`[data-tab-select="${chainID}"]`).click(); await active('History A.org');
  assert(await page.locator('#note-back').isEnabled());
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator('#note-back').isVisible());
  assert(await page.locator('#document .document-toolbar').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  assert.deepEqual(errors, []);
  console.log(`PASS (${engine.name()}): per-tab Back/Forward, linked notes, file picker, branch truncation, fold/preview restoration, fresh planner stacks and mobile toolbar.`);
} finally { await browser.close(); }
