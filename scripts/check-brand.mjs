// Verify platform icon freshness and Android geometry; render generated layers
// through the nominal 72dp mask of Android's 108dp adaptive canvas.
import { readFile, mkdir } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
import './check-icons.mjs';

const data = async (path, type = 'image/png') => `data:${type};base64,${(await readFile(path)).toString('base64')}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 540 } });
  const root = 'app/build/android/res';
  const foreground = await data(`${root}/drawable-nodpi/ic_launcher_foreground.png`);
  const background = await data(`${root}/drawable-nodpi/ic_launcher_background.png`);
  const expected = [
    ['app/build/icon.png', 1024, false], ['app/build/icon-ios.png', 1024, true],
    [`${root}/drawable-nodpi/ic_launcher_foreground.png`, 432, false],
    [`${root}/drawable-nodpi/ic_launcher_background.png`, 432, true],
    ...Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }).map(([density, size]) => [`${root}/mipmap-${density}/ic_launcher.png`, size, true]),
  ];
  for (const [path, size, opaque] of expected) {
    const info = await page.evaluate(async url => {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
      let transparent = false, radius = 0;
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
        const alpha = pixels[(y * img.width + x) * 4 + 3];
        if (alpha < 255) transparent = true;
        if (alpha >= 128) radius = Math.max(radius, Math.hypot(x + .5 - img.width / 2, y + .5 - img.height / 2));
      }
      return { width: img.width, height: img.height, transparent, radius };
    }, await data(path));
    assert.equal(info.width, size, path); assert.equal(info.height, size, path);
    assert.equal(info.transparent, !opaque, path);
    if (path.endsWith('ic_launcher_foreground.png')) assert.ok(info.radius < size * 33 / 108, 'Foreground exceeds the Android 66dp safe circle');
  }
  const icon = (shape, size) => `<span class="icon ${shape}" style="width:${size}px;height:${size}px"><img src="${background}"><img src="${foreground}"></span>`;
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:40px;background:#11192a;color:#ececff;font:15px system-ui}h1{font-size:29px;margin:0 0 12px}p{color:#a7b2cc}.row{display:flex;gap:60px;align-items:center;margin-top:36px}.icon{display:inline-block;position:relative;overflow:hidden}.circle{border-radius:50%}.square{border-radius:24%}.icon img{position:absolute;width:150%;height:150%;left:-25%;top:-25%}.samples{display:flex;gap:24px;align-items:center}.label{font:12px monospace;color:#a7b2cc;margin-top:16px}</style><h1>Quantum Confident · Android launcher</h1><p>Actual generated layers, with Android's 108dp → 72dp crop. Foreground is 20% smaller.</p><div class="row"><div>${icon('circle',192)}<div class="label">Circular launcher mask</div></div><div>${icon('square',192)}<div class="label">Rounded-square mask</div></div><div><div class="samples">${icon('circle',64)}${icon('circle',48)}</div><div class="label">64px / 48px</div></div></div>`);
  await page.locator('h1').evaluate(el => { el.textContent = 'Electric sky · Android launcher'; });
  await page.locator('p').evaluate(el => { el.textContent = "Generated launcher layers with Android's 108dp → 72dp crop."; });
  await page.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  const output = process.env.ICON_PREVIEW_DIR || '/tmp/opencode';
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/android-launcher-preview.png` });
  console.log('PASS: current artwork, icon sizes/alpha, Android safe circle; launcher-mask preview generated.');
} finally { await browser.close(); }
