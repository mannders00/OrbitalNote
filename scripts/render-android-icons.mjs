// Generate checked-in Android layers from the canonical Ion Blue artwork.
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const mark = await readFile('app/ui/mark.svg', 'utf8');
  const defs = mark.match(/<defs>[\s\S]*?<\/defs>/)[0];
  const art = mark.slice(mark.indexOf('<g stroke='), mark.lastIndexOf('</svg>'));
  const background = '<rect width="256" height="256" fill="url(#bg01)"/><rect width="256" height="256" fill="url(#light01)"/>';
  const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">${defs}${body}</svg>`;
  const root = 'app/build/android/res';
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  async function render(path, size, body) {
    await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
    await page.setViewportSize({ width: size, height: size });
    const data = Buffer.from(svg(body)).toString('base64');
    await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:100vw;height:100vh}</style><img src="data:image/svg+xml;base64,${data}">`);
    await page.locator('img').evaluate(img => img.decode());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path, omitBackground: true });
  }
  await render(`${root}/drawable-nodpi/ic_launcher_background.png`, 432, background);
  // Keep the notebook/orbit inside the adaptive-icon safe region.
  await render(`${root}/drawable-nodpi/ic_launcher_foreground.png`, 432, `<g transform="translate(19.2 19.2) scale(.85)">${art}</g>`);
  for (const [density, size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]) {
    await render(`${root}/mipmap-${density}/ic_launcher.png`, size, background + art);
  }
  console.log('Rendered Android adaptive layers and five opaque legacy launcher sizes.');
} finally { await browser.close(); }
