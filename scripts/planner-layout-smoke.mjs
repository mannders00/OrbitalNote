// Run against app/dev with a disposable workspace. BROWSER=webkit checks WKWebView layout.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:9252';
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  const api = async (method, args = {}) => {
    const r = await page.request.post(base + '/api', { data: { method, ...args } });
    assert(r.ok(), await r.text()); return r.json();
  };
  const state = await api('Status'), path = 'planner-layout.org';
  const source = '#+TODO: TODO WAITING-ON-REVIEW | DONE\n' +
    '* TODO Review the launch plan and confirm every owner before the next team meeting :design:\nSCHEDULED: <2026-11-10 Tue 09:00-10:00>\n' +
    '* TODO Short appointment\nSCHEDULED: <2026-11-10 Tue 10:15-10:30>\n' +
    '* Customer conversation\n<2026-11-10 Tue 09:30-10:30>\n' +
    '* TODO First all-day task\nSCHEDULED: <2026-11-10 Tue>\n' +
    '* TODO Second all-day task\nDEADLINE: <2026-11-10 Tue>\n' +
    '* TODO Third all-day task\nSCHEDULED: <2026-11-10 Tue>\n' +
    '* WAITING-ON-REVIEW Overdue decision\nDEADLINE: <2026-11-09 Mon>\n' +
    '* TODO Unscheduled follow-up\n' +
    '* TODO Column fixture current\nSCHEDULED: <2026-11-11 Wed>\n' +
    '* WAITING-ON-REVIEW Column fixture long state\nSCHEDULED: <2026-11-12 Thu>\n' +
    '* Column fixture event\n<2026-11-13 Fri>\n' +
    '* TODO Column fixture repeating\nSCHEDULED: <2026-11-14 Sat +1d>\n' +
    '* DONE Column fixture completed\nSCHEDULED: <2026-11-15 Sun>\nCLOSED: [2026-11-15 Sun 12:00]\n' +
    '* TODO Column fixture history\nSCHEDULED: <2026-11-16 Mon +1w>\n:LOGBOOK:\n- State "DONE" from "TODO" [2026-11-15 Sun 12:00] ; occurrence SCHEDULED: [2026-11-15 Sun]\n:END:\n';
  const old = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  await api('Save', { id: state.id, path, revision: old?.revision || '', source });
  const initialize = async (p, layout) => {
    await p.clock.setFixedTime(new Date(2026, 10, 10, 10, 42));
    await p.addInitScript(({ key, path, layout }) => {
      localStorage.setItem('org-theme', 'dark'); localStorage.setItem('org-theme-mode', 'light');
      localStorage.setItem('orbitalnote-agenda-views-' + key, JSON.stringify({ active: 'Planner check', views: [{ name: 'Planner check', query: { mode: 'all', range: 'all', text: '', kind: '', rules: [{ field: 'file', operator: 'is', value: path }] } }] }));
      if (layout) localStorage.setItem('org-layout-' + key, JSON.stringify(layout));
    }, { key: state.key, path, layout });
    await p.goto(base);
  };
  const noOverflow = async (p, selector) => {
    await p.waitForFunction(selector => {
      const el = document.querySelector(selector); return el.clientWidth && el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= innerWidth + 1;
    }, selector);
  };
  await initialize(page);
  await page.locator('[data-filter="today"]').click();
  assert.match(await page.locator('.is-overdue .entry-date').innerText(), /Nov 9/);
  await page.locator('#agenda-query').fill('no matching title');
  assert(await page.locator('#agenda-list .empty').isVisible());
  await page.locator('#agenda-query').fill('');
  await page.locator('#agenda-minimal').click();
  assert(await page.locator('.agenda-filterbar').isHidden());
  assert.equal(await page.locator('#agenda-results-count').count(), 0);
  await page.locator('#agenda-minimal').click();
  const edit = page.getByRole('button', { name: 'Edit task: Short appointment', exact: true });
  await edit.click();
  assert.equal(await page.locator('#modal [name="time"]').inputValue(), '10:15');
  assert.equal(await page.locator('#modal [name="endTime"]').inputValue(), '10:30');
  await page.keyboard.press('Escape');

  for (const [width, theme] of [[1440, 'dark'], [800, 'dark'], [390, 'dark'], [320, 'dark'], [390, 'plum']]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(theme => { const input = document.querySelector('#theme'); input.value = theme; input.dispatchEvent(new Event('change')); }, theme);
    await page.locator('#agenda-query').fill('Column fixture');
    await page.locator('#agenda-today').click();
    let column, control;
    for (let day = 11; day <= 15; day++) {
      await page.locator('#agenda-next').click();
      const rows = await page.locator('.agenda-row').evaluateAll(rows => rows.map(row => {
        const state = row.querySelector('.task-state'), entry = row.querySelector('.agenda-entry').getBoundingClientRect();
        const list = row.closest('#agenda-list').getBoundingClientRect(), rect = row.getBoundingClientRect();
        const r = state?.getBoundingClientRect(), s = state && getComputedStyle(state);
        return { x: entry.x - list.x, overlaps: state && r.right > entry.left, centered: !state || Math.abs(r.y + r.height / 2 - rect.y - rect.height / 2) <= 1, state: state && { width: r.width, height: r.height, x: r.x - list.x, size: s.fontSize, weight: s.fontWeight, leading: s.lineHeight } };
      }));
      assert(rows.length, `Column fixture exists on November ${day}`);
      for (const row of rows) {
        column ??= row.x;
        assert.equal(row.x, column, 'Titles retain their left edge on custom-state, stateless and projected days');
        if (row.state) {
          assert(row.centered, 'Task states are vertically centered within each entry');
          assert(!row.overlaps, 'State controls do not overlap the title or its tag marker in padded themes');
          control ??= row.state;
          assert.deepEqual(row.state, control, 'Current, custom, completed and projected states share dimensions and alignment');
        }
      }
      await noOverflow(page, '.agenda-filterbar');
    }
    assert(await page.locator('.agenda-row.projected .task-state').count());
    assert(await page.locator('.agenda-row.completed .task-state').count());
    const toolbar = await page.locator('.agenda-filterbar').evaluate(el => {
      const rect = selector => el.querySelector(selector).getBoundingClientRect();
      const range = rect('#agenda-filters'), nav = rect('.calendar-nav'), search = rect('.agenda-query-input');
      const buttons = [...el.querySelectorAll('#agenda-filters button')];
      const toolbar = el.getBoundingClientRect();
      return { aligned: Math.abs(range.y + range.height / 2 - nav.y - nav.height / 2) < 1, dayFirst: Math.abs(nav.left - toolbar.left) < 1, searchLast: Math.abs(search.right - toolbar.right) < 1, searchWidth: search.width, buttonsFit: buttons.every(b => b.getBoundingClientRect().right <= range.right + 1) };
    });
    if (width === 1440) { assert(toolbar.aligned, 'Day navigation shares the desktop control row'); assert(toolbar.searchWidth <= 240); }
    assert(toolbar.dayFirst && toolbar.searchLast, 'Day navigation is leftmost and search is rightmost');
    assert(toolbar.buttonsFit, 'Every range label stays inside the segmented control');
  }
  await page.evaluate(() => { const input = document.querySelector('#theme'); input.value = 'dark'; input.dispatchEvent(new Event('change')); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#agenda-query').fill(''); await page.locator('#agenda-today').click();

  await page.locator('#ribbon [data-view="calendar"]').click();
  await page.locator('#calendar-view').selectOption('Planner check', { force: true });
  const day = page.locator('.calendar-cell[data-drop-date="2026-11-10"]');
  assert.equal(await day.locator('.calendar-event').count(), 3);
  assert.equal(await day.locator('.calendar-more').textContent(), '+3 more');
  await day.locator('.calendar-more').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#calendar').getAttribute('data-mode'), 'day');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'calendar-grid');
  assert.equal(await page.locator('#calendar-grid [data-open]').count(), 6, 'Busy month days retain every entry in the day view');
  const short = page.locator('.time-block').filter({ hasText: 'Short appointment' });
  assert.equal(await short.evaluate(el => el.getBoundingClientRect().height), 15, 'Short appointments keep their true duration');
  assert(await short.locator('.calendar-event-title').isVisible());
  assert(await short.locator('.calendar-event-time').isHidden());
  assert.match(await short.locator('.timed-event').getAttribute('title'), /10:15–10:30 AM/);
  await page.locator('[data-calendar="week"]').click();
  assert.match(await page.locator('#calendar-title').textContent(), /Nov.*9.*15.*2026/);
  assert.equal(await page.locator('[data-calendar="week"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#calendar-next').click();
  assert.match(await page.locator('#calendar-title').textContent(), /16.*22/);
  await page.locator('#calendar-prev').click();

  for (const mode of ['light', 'dark']) {
    await page.evaluate(mode => { const input = document.querySelector('#theme-mode'); input.value = mode; input.dispatchEvent(new Event('change')); }, mode);
    for (const width of [1440, 800, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('#ribbon [data-view="agenda"]').click();
      await noOverflow(page, '#agenda');
      const titleWidth = await page.locator('.entry-main strong').filter({ hasText: 'Review the launch plan' }).evaluate(el => el.getBoundingClientRect().width);
      assert(titleWidth > 130, `Task titles have useful space at ${width}px in ${mode}`);
      await page.locator('#ribbon [data-view="calendar"]').click();
      await noOverflow(page, '#calendar');
      await page.locator('#calendar-grid').evaluate(el => { el.scrollTop = 600; el.scrollLeft = 130; });
      const pinned = await page.locator('.time-day-headers').boundingBox(), grid = await page.locator('#calendar-grid').boundingBox();
      assert(Math.abs(pinned.y - grid.y - 1) < 1);
      assert(await page.locator('#calendar-modes').isVisible());
      const alignment = await page.locator('.time-day-headers > button').evaluateAll(headers => {
        const days = [...document.querySelectorAll('.time-day')], all = [...document.querySelectorAll('.all-day-row > div')];
        return headers.every((h, i) => {
          const r = h.getBoundingClientRect();
          return r.width >= 100 && Math.abs(r.x - days[i].getBoundingClientRect().x) < 1 && Math.abs(r.x - all[i].getBoundingClientRect().x) < 1;
        });
      });
      assert(alignment, 'Day headings, all-day cells and timed columns stay aligned while scrolling');
    }
  }
  await page.locator('#calendar-today').click();
  await page.waitForFunction(() => {
    const grid = document.querySelector('#calendar-grid').getBoundingClientRect(), day = document.querySelector('.time-day.is-today').getBoundingClientRect();
    return day.left >= grid.left && day.right <= grid.right;
  });
  await page.locator('[data-calendar="year"]').click();
  await noOverflow(page, '#calendar-grid');
  await page.locator('.mini-month h3 button').first().focus(); await page.keyboard.press('Enter');
  assert.match(await page.locator('#calendar-title').textContent(), /January/);
  await page.locator('[data-calendar="year"]').click();
  await page.locator('[data-day="2026-12-31"]').click();
  await page.locator('[data-calendar="week"]').click();
  assert.match(await page.locator('#calendar-title').textContent(), /2026.*2027/);
  await page.locator('#calendar-today').click();
  await page.locator('#ribbon [data-view="settings"]').click();
  await page.locator('#calendar-time-format').selectOption('24');
  await page.locator('#ribbon [data-view="calendar"]').click(); await page.locator('[data-calendar="day"]').click();
  assert.match(await short.locator('.timed-event').getAttribute('title'), /10:15–10:30/);
  assert.equal((await api('Read', { id: state.id, path })).source, source, 'Viewing, navigation, filtering and layout do not change Org source');
  await page.locator('[data-calendar="month"]').click();
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await page.locator('.calendar-event').filter({ hasText: 'First all-day task' }).dispatchEvent('dragstart', { dataTransfer: transfer });
  await page.locator('.calendar-cell[data-drop-date="2026-11-11"]').dispatchEvent('drop', { dataTransfer: transfer });
  await page.locator('.calendar-cell[data-drop-date="2026-11-11"] .calendar-event').filter({ hasText: 'First all-day task' }).waitFor();
  const moved = await api('Read', { id: state.id, path });
  assert.match(moved.source, /First all-day task\nSCHEDULED: <2026-11-11 Wed>/, 'Month drag/drop still reschedules the underlying timestamp');
  await api('Save', { id: state.id, path, source, revision: moved.revision });
  await page.close();

  const split = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  split.on('pageerror', e => errors.push(e.message));
  await initialize(split, { tree: { axis: 'horizontal', ratio: .5, children: [{ id: 'left', tabs: ['view:agenda'], active: 'view:agenda' }, { id: 'right', tabs: ['view:calendar'], active: 'view:calendar' }] }, focused: 'left' });
  await split.locator('#agenda').waitFor(); await split.locator('#calendar').waitFor();
  await noOverflow(split, '#agenda'); await noOverflow(split, '#calendar');
  await split.locator('#agenda .agenda-query-builder summary').click();
  await split.locator('#agenda .query-popup').waitFor({ state: 'visible' });
  assert(await split.locator('#agenda .query-popup').evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && el.contains(document.elementFromPoint(r.left + 8, r.bottom - 8));
  }), 'The filter panel escapes split-pane clipping');
  await split.getByRole('button', { name: 'Close filters', exact: true }).click();
  await split.locator('.agenda-entry').filter({ hasText: 'Short appointment' }).click();
  assert(await split.locator('#agenda').isVisible(), 'Opening a task preserves the planner in its split pane');
  await split.locator('.ui-document').filter({ has: split.locator('.ui-source') }).first().waitFor();
  await split.close();

  const stacked = await browser.newPage({ viewport: { width: 1100, height: 650 } });
  stacked.on('pageerror', e => errors.push(e.message));
  await initialize(stacked, { tree: { axis: 'vertical', ratio: .5, children: [{ id: 'top', tabs: ['view:agenda'], active: 'view:agenda' }, { id: 'bottom', tabs: ['view:calendar'], active: 'view:calendar' }] }, focused: 'bottom' });
  await stacked.locator('#calendar-grid').scrollIntoViewIfNeeded();
  const shortPane = await stacked.locator('#calendar-grid').boundingBox();
  assert(shortPane.height >= 220 && shortPane.y + shortPane.height <= 651, 'Short stacked panes keep a usable, reachable calendar');
  await stacked.locator('#calendar-capture').scrollIntoViewIfNeeded();
  assert(await stacked.locator('#calendar-capture').isVisible());
  await stacked.close();

  if (engine === chromium) {
    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    touch.on('pageerror', e => errors.push(e.message));
    await initialize(touch); await touch.locator('#ribbon [data-view="calendar"]').tap();
    await touch.locator('#calendar-view').selectOption('Planner check', { force: true });
    await touch.locator('[data-calendar="week"]').tap();
    const client = await touch.context().newCDPSession(touch);
    const send = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const drag = async (from, to, hold = false) => {
      await send('touchStart', from.x, from.y);
      if (hold) await touch.locator('.calendar-touch-ready').waitFor();
      for (let i = 1; i <= 8; i++) {
        await send('touchMove', from.x + (to.x - from.x) * i / 8, from.y + (to.y - from.y) * i / 8);
      }
      await send('touchEnd');
    };
    const grid = touch.locator('#calendar-grid');
    const r = await grid.boundingBox(), before = await grid.evaluate(el => el.scrollTop);
    await drag({ x: r.x + 115, y: r.y + r.height - 40 }, { x: r.x + 115, y: r.y + r.height - 160 });
    await touch.waitForFunction(before => document.querySelector('#calendar-grid').scrollTop > before + 40, before);
    assert(await touch.locator('#modal').isHidden(), 'An ordinary swipe scrolls without creating a task');
    // Stop any momentum before testing an intentional hold-and-drag.
    await touch.waitForTimeout(500);
    await drag({ x: r.x + r.width - 25, y: r.y + r.height - 40 }, { x: r.x + 95, y: r.y + r.height - 40 });
    await touch.waitForFunction(() => document.querySelector('#calendar-grid').scrollLeft > 40);
    assert(await touch.locator('#modal').isHidden(), 'Horizontal swipes reveal more days without editing');
    await touch.waitForTimeout(500);
    await grid.evaluate(el => { el.scrollTop = 480; el.scrollLeft = 0; });
    const event = touch.locator('.timed-event').filter({ hasText: 'Review the launch plan' });
    const b = await event.boundingBox(), from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await drag(from, { x: from.x, y: from.y + 60 }, true);
    await touch.waitForFunction(() => [...document.querySelectorAll('.time-block')].some(el => el.textContent.includes('Review the launch plan') && el.style.top === '600px'));
    const block = touch.locator('.time-block').filter({ hasText: 'Review the launch plan' });
    const handle = await block.locator('[data-resize="end"]').boundingBox();
    const end = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
    await drag(end, { x: end.x, y: end.y + 30 }, true);
    await touch.waitForFunction(() => [...document.querySelectorAll('.time-block')].some(el => el.textContent.includes('Review the launch plan') && el.style.height === '90px'));
    await grid.evaluate(el => el.scrollTop = 600);
    const slot = await touch.locator('.time-slot[data-capture="2026-11-10"][data-time="12:00"]').boundingBox();
    const at = { x: slot.x + slot.width / 2, y: slot.y + 2 };
    await drag(at, { x: at.x, y: at.y + 47 }, true);
    await touch.locator('#modal').waitFor();
    assert.equal(await touch.locator('#modal [name="time"]').inputValue(), '12:00');
    assert.equal(await touch.locator('#modal [name="endTime"]').inputValue(), '13:00');
    await touch.close();
  }
  assert.deepEqual(errors, []);
  console.log(`PASS responsive planner toolbar, stable task-state columns across days, readable layouts at 320–1440px, both appearances, pinned/aligned calendar, busy-day access, keyboard year navigation, unchanged source, split-pane opening${engine === chromium ? ', and touch scroll/hold-drag gestures' : ' (WebKit)'}.`);
} finally { await browser.close(); }
