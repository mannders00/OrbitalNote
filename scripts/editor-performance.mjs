// Disposable app/dev workspace. Reports main-thread command latency, not network time.
// CPU_RATE=4 simulates CPU pressure; it is not a substitute for real-device profiling.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
import { writeFile } from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://127.0.0.1:9293';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const count of (process.env.SIZES || '100,1000').split(',').map(Number)) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const api = async (method, args = {}) => { const r = await page.request.post(base + '/api', { data: { method, ...args } }); assert.ok(r.ok(), await r.text()); return r.json(); };
    const status = await api('Status'), path = `perf-${count}.org`;
    const source = Array.from({ length: count }, (_, i) => `* TODO Task ${i}\n:PROPERTIES:\n:ID: item-${i}\n:END:\nA paragraph with *bold*, /italic/, and [[file:other.org][a link]].\nMore text to navigate quickly.\n\n`).join('');
    const prior = status.files.some(f => f.path === path) ? await api('Read', { id: status.id, path }) : null;
    await api('Save', { id: status.id, path, source, revision: prior?.revision || '' });
    await page.addInitScript(({ key, path }) => {
      localStorage.setItem('org-vi-mode', 'true'); localStorage.setItem('org-right-sidebar', 'closed'); localStorage.setItem('org-left-sidebar', 'closed');
      localStorage.setItem('org-layout-' + key, JSON.stringify({ tree: { id: 'perf', tabs: ['file:' + path], active: 'file:' + path }, focused: 'perf' }));
    }, { key: status.key, path });
    await page.goto(base); const editor = page.locator('#source'); await editor.waitFor();
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU_RATE || 4) });
    await session.send('Profiler.enable'); await session.send('Profiler.start');
    for (const folded of [false, true]) {
      await editor.evaluate((el, folded) => { el.foldHeading(folded ? 'fold-all' : 'unfold-all'); el.setSelectionRange(0, 0); el.focus(); }, folded);
      const result = await editor.evaluate(async el => {
        const durations = [], frames = [];
        let lastFrame = performance.now();
        for (let i = 0; i < 80; i++) {
          const start = performance.now(), key = i < 40 ? 'j' : 'k';
          el.dispatchEvent(new KeyboardEvent('keydown', { key, code: key === 'j' ? 'KeyJ' : 'KeyK', bubbles: true, cancelable: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
          await Promise.resolve(); durations.push(performance.now() - start);
          if (i % 8 === 7) { await new Promise(requestAnimationFrame); frames.push(performance.now() - lastFrame); lastFrame = performance.now(); }
        }
        const summary = a => { a.sort((x,y) => x-y); return { p50: a[Math.floor(a.length * .5)], p95: a[Math.floor(a.length * .95)], max: a.at(-1) }; };
        return { commandMs: summary(durations), burstFrameMs: summary(frames), cursor: el.selectionStart };
      });
      console.log(JSON.stringify({ headings: count, bytes: source.length, folded, ...result }));
    }
    await editor.evaluate(el => { el.foldHeading('unfold-all'); const at = el.value.indexOf('A paragraph'); el.setSelectionRange(at, at); });
    const typing = await editor.evaluate(async el => {
      const samples = [];
      for (let i = 0; i < 30; i++) { const at = performance.now(); el.replaceText('x'); await Promise.resolve(); samples.push(performance.now() - at); await new Promise(requestAnimationFrame); }
      samples.sort((a,b) => a-b); return { p50: samples[15], p95: samples[28], max: samples.at(-1) };
    });
    console.log(JSON.stringify({ headings: count, typingMs: typing }));
    const { profile } = await session.send('Profiler.stop');
    if (process.env.PROFILE_PREFIX) await writeFile(`${process.env.PROFILE_PREFIX}-${count}.cpuprofile`, JSON.stringify(profile));
    const hits = new Map();
    for (const id of profile.samples || []) hits.set(id, (hits.get(id) || 0) + 1);
    console.log(profile.nodes.map(n => ({ fn: n.callFrame.functionName, url: n.callFrame.url.split('/').at(-1), samples: hits.get(n.id) || 0 })).sort((a,b) => b.samples-a.samples).slice(0, 15));
    assert.deepEqual(errors, []); await page.close();
  }
} finally { await browser.close(); }
