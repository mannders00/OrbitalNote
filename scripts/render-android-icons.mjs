// Generate checked-in Android layers from the canonical Quantum Confident artwork.
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const mark = await readFile('app/ui/mark.svg', 'utf8');
  const defs = mark.match(/<defs>[\s\S]*?<\/defs>/)[0];
  const art = mark.match(/<g id="foreground">([\s\S]*?)<\/g><!-- foreground-end -->/)[1];
  const background = mark.match(/<g id="background">([\s\S]*?)<\/g><!-- background-end -->/)[1].replace(/ rx="[^"]*"/g, '');
  const inset = scale => `<g transform="translate(${128 * (1 - scale)} ${128 * (1 - scale)}) scale(${scale})">${art}</g>`;
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
  // Android crops a 108dp layer to a nominal 72dp launcher viewport. Account
  // for that 1.5x apparent zoom: .68 replaces .85 for 20% smaller foreground art.
  await render(`${root}/drawable-nodpi/ic_launcher_foreground.png`, 432, inset(.68));
  for (const [density, size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]) {
    await render(`${root}/mipmap-${density}/ic_launcher.png`, size, background + inset(.9));
  }
  console.log('Rendered Android adaptive layers and five opaque legacy launcher sizes.');
} finally { await browser.close(); }
