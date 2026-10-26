import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const bannerOnly = process.argv.includes('--banner-only');
const appOnly = process.argv.includes('--app-only');
const iconSize = 832;
// Continuous-curvature desktop tile: gradual transitions from straight sides
// into corners, rather than the circular arcs of SVG rect rx.
const macTile = 'M80 0H176C204 0 218 0 230 8C238 13 243 18 248 26C256 38 256 52 256 80V176C256 204 256 218 248 230C243 238 238 243 230 248C218 256 204 256 176 256H80C52 256 38 256 26 248C18 243 13 238 8 230C0 218 0 204 0 176V80C0 52 0 38 8 26C13 18 18 13 26 8C38 0 52 0 80 0Z';
function macIcon(mark) {
  // Center the dominant front face (x=73..180, y=49..201), rather than
  // including the top/right extrusion. Orbit and sun follow this placement.
  const tabletX = 128 - (128 + (126.5 - 128) * 1.12 * 1.12);
  const tabletY = 128 - (128 + (125 - 128) * 1.0752 * 1.12);
  const defs = mark.match(/<defs>([\s\S]*?)<\/defs>/)[1];
  const art = mark.match(/<g id="foreground">([\s\S]*?)<\/g><!-- foreground-end -->/)[1]
    .replace(/<rect x="1" y="1" width="254"[^>]*\/>/, '')
    // Match the reference's tall central-symbol presence without expanding
    // the orbital ring into the tile's corner clearance.
    .replace('scale(1 0.96)', 'scale(1.12 1.0752)');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none"><defs>${defs}
    <clipPath id="mac-mask"><path d="${macTile}"/></clipPath>
    <linearGradient id="mac-material" x1="128" y1="0" x2="128" y2="256" gradientUnits="userSpaceOnUse"><stop stop-color="#262626"/><stop offset=".5" stop-color="#202020"/><stop offset="1" stop-color="#191919"/></linearGradient>
    <linearGradient id="mac-edge" x1="0" y1="0" x2="0" y2="256" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".12"/><stop offset=".35" stop-color="#fff" stop-opacity=".025"/><stop offset=".75" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
    <filter id="mac-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="#000" flood-opacity=".5"/></filter>
    </defs><g transform="translate(${(1024 - iconSize) / 2} ${(1024 - iconSize) / 2}) scale(${iconSize / 256})"><path d="${macTile}" fill="url(#mac-material)" filter="url(#mac-shadow)"/><g clip-path="url(#mac-mask)"><g transform="translate(${tabletX} ${tabletY})">${art}</g><path d="${macTile}" stroke="url(#mac-edge)" stroke-width="3"/></g></g></svg>`;
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
   const mark = await readFile('app/ui/mark.svg', 'utf8');
  if (!bannerOnly && !appOnly) {
  await copyFile('app/ui/mark.svg', 'web/assets/mark.svg');
  const account = await readFile('server/website.go', 'utf8');
  const inlineMark = mark.trim().replace('<svg ', '<svg aria-hidden="true" width="32" height="32" ');
  await writeFile('server/website.go', account.replace(/<svg[^>]*>[\s\S]*?<\/svg>OrbitalNote/, inlineMark + 'OrbitalNote'));
  }
  if (!appOnly) {
  const image = (await readFile('web/assets/engineer-desktop.png')).toString('base64');
  const html = (await readFile('scripts/brand-banner.html', 'utf8')).replace('BRAND_MARK', mark).replace('SCREENSHOT', 'data:image/png;base64,' + image);
  await page.setContent(html);
  await page.locator('img').evaluate(img => img.decode());
  await mkdir('docs/assets', { recursive: true });
  await copyFile('web/assets/engineer-desktop.png', 'docs/assets/workspace.png');
  await page.screenshot({ path: 'docs/assets/orbitalnote-banner.png' });
  await copyFile('docs/assets/orbitalnote-banner.png', 'docs/assets/orbitalnote-banner-solid.png');
  await copyFile('docs/assets/orbitalnote-banner.png', 'docs/assets/social-preview.png');
  await copyFile('docs/assets/social-preview.png', 'web/assets/social-preview.png');
  }
  if (!bannerOnly) {
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.setContent(`<style>html,body{margin:0;width:1024px;height:1024px;overflow:hidden;background:transparent}svg{display:block;width:1024px;height:1024px}</style>${macIcon(mark)}`);
  await page.screenshot({ path: 'app/build/icon.png', omitBackground: true });
   const defs = mark.match(/<defs>[\s\S]*?<\/defs>/)[0];
   const background = mark.match(/<g id="background">([\s\S]*?)<\/g><!-- background-end -->/)[1].replace(/ rx="[^"]*"/g, '');
   const art = mark.match(/<g id="foreground">([\s\S]*?)<\/g><!-- foreground-end -->/)[1].replace(/<rect x="1" y="1" width="254"[^>]*\/>/, '');
   const squareMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">${defs}${background}${art}</svg>`;
   await page.setContent(`<style>html,body{margin:0;background:#091123}svg{display:block;width:1024px;height:1024px}</style>${squareMark}`);
   await page.screenshot({ path: 'app/build/icon-ios.png' });
   await import('./render-android-icons.mjs');
   const { iconManifest } = await import('./icon-assets.mjs');
   await writeFile('app/build/icon-manifest.json', JSON.stringify(await iconManifest(), null, 2) + '\n');
  }
  console.log(appOnly ? 'Rendered local app icons.' : 'Rendered brand assets.');
} finally { await browser.close(); }
