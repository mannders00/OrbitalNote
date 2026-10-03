// Run against a disposable app/dev workspace.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const base = process.env.BASE_URL || 'http://127.0.0.1:9256';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const api = async (method, args = {}) => { const r = await page.request.post(base + '/api', { data: { method, ...args } }); assert.ok(r.ok(), await r.text()); return r.json(); };
  const state = await api('Status'), path = 'calendar-gestures.org';
  const previous = state.files.some(f => f.path === path) ? await api('Read', { id: state.id, path }) : null;
  await api('Save', { id: state.id, path, revision: previous?.revision || '', source: '* TODO Gesture timed\nSCHEDULED: <2026-09-29 Tue 09:00-10:00>\n* TODO Gesture day\nDEADLINE: <2026-09-29 Tue>\n' });
  await page.clock.setFixedTime(new Date(2026, 8, 29, 12));
  await page.goto(base); await page.locator('#ribbon [data-view="calendar"]').click(); await page.locator('[data-calendar="week"]').click();
  const waitStamp = async text => { await page.waitForFunction(async ({base,path,id,text}) => { const r = await fetch(base + '/api', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({method:'Read',id,path}) }); return (await r.json()).source.includes(text); }, {base,path,id:state.id,text}); };
  const drag = async (a,b) => { await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.mouse.move(b.x,b.y,{steps:12}); await page.mouse.up(); };
  const center = async locator => { await locator.waitFor({state:'visible'}); const b=await locator.boundingBox(); return {x:b.x+b.width/2,y:b.y+b.height/2}; };
  const slot = (date,time) => page.locator(`.time-slot[data-capture="${date}"][data-time="${time}"]`);
  await slot('2026-09-29','09:00').scrollIntoViewIfNeeded();
  let a=await center(page.locator('.timed-event').filter({hasText:'Gesture timed'}));
  await drag(a,{x:a.x,y:a.y+60}); await waitStamp('10:00-11:00');
  const block=page.locator('.time-block').filter({hasText:'Gesture timed'});
  const geometry = await block.evaluate(el=>{
    const block=el.getBoundingClientRect(),event=el.querySelector('.timed-event').getBoundingClientRect(),day=el.closest('.time-day').getBoundingClientRect();
    return {top:event.top-block.top,bottom:event.bottom-block.bottom,left:event.left-block.left,right:event.right-block.right,minute:block.top-day.top,dayHeight:day.height};
  });
  assert.deepEqual(geometry,{top:0,bottom:0,left:0,right:0,minute:600,dayHeight:1440});
  const scrollBeforeResize=await page.locator('#calendar').evaluate(el=>el.scrollTop);
  a=await center(block.locator('[data-resize="end"]')); await drag(a,{x:a.x,y:a.y+30}); await waitStamp('10:00-11:30');
  await page.waitForFunction(()=>[...document.querySelectorAll('.time-block')].some(el=>el.textContent.includes('Gesture timed') && el.style.height==='90px'));
  assert.equal(await page.locator('#calendar').evaluate(el=>el.scrollTop),scrollBeforeResize,'resizing preserves calendar scroll');
  a=await center(page.locator('.timed-event').filter({hasText:'Gesture timed'}));
  await drag(a,await center(page.locator('.all-day-row [data-drop-date="2026-09-30"]'))); await waitStamp('SCHEDULED: <2026-09-30 Wed>');
  a=await center(page.locator('.all-day-row .calendar-event').filter({hasText:'Gesture day'}));
  const target=await slot('2026-09-30','10:00').boundingBox();
  await drag(a,{x:target.x+target.width/2,y:target.y+2}); await waitStamp('DEADLINE: <2026-09-30 Wed 10:00-11:00>');
  await slot('2026-10-01','10:00').waitFor({state:'visible'});
  const from=await slot('2026-10-01','10:00').boundingBox();
  await drag({x:from.x+from.width/2,y:from.y+2},{x:from.x+from.width/2,y:from.y+47});
  await page.locator('#modal').waitFor();
  assert.equal(await page.locator('#modal [name="time"]').inputValue(),'10:00');
  assert.equal(await page.locator('#modal [name="endTime"]').inputValue(),'11:00');
  await page.keyboard.press('Escape');
  await page.locator('#calendar').evaluate(el=>el.scrollTop=600);
  const pinned=await page.locator('.time-day-headers').boundingBox(), pane=await page.locator('#calendar').boundingBox();
  assert.ok(Math.abs(pinned.y-pane.y)<1,JSON.stringify({pinned,pane}));
  console.log('PASS: timed move, resize, all-day conversion, deadline preservation, drag creation range, flush pinned weekday header.');
} finally { await browser.close(); }
