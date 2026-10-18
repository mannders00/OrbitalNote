// Mock only the native bridge; exercise the real settings markup and controller.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage();
  await page.route('**/app.js', route => route.fulfill({ contentType: 'text/javascript', body: `import {setupSyncSettings} from './sync.js'; const settings=document.querySelector('#settings'); settings.hidden=false; setupSyncSettings(settings);` }));
  await page.route('**/api.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const native=true;
    window.calls=[]; window.approved=false;
    let signedIn=false, connected=false, server='';
    export async function openExternal(url){window.openedURL=url;}
    export async function syncCall(method,...args){
      window.calls.push([method,...args]);
      if(method==='Status')return {server,signedIn,connected,message:connected?'Up to date':'Not connected',used:0,quota:1e9};
      if(method==='StartServer'){server=args[0];return {code:'ABCD',url:server+'/device?code=ABCD'};}
      if(method==='Finish'){if(!window.approved)throw new Error('approve the device code on the website first');signedIn=true;}
      if(method==='Connect')connected=true;
      if(method==='Disconnect'){signedIn=false;connected=false;}
    }` }));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:9240');
  assert.ok(await page.locator('#sync-server-field').isHidden());
  assert.ok(await page.locator('#sync-workspace-setup').isHidden());
  await page.locator('#sync-start').click();
  assert.deepEqual(await page.evaluate(() => window.calls.find(c => c[0] === 'StartServer')), ['StartServer', 'https://sync.orbitalnote.org']);
  assert.equal(await page.evaluate(() => window.openedURL), 'https://sync.orbitalnote.org/device?code=ABCD');
  await page.waitForFunction(() => window.calls.some(c => c[0] === 'Finish'));
  assert.ok(await page.locator('#sync-workspace-setup').isHidden());
  await page.evaluate(() => { window.approved = true; });
  await page.locator('#sync-workspace-setup').waitFor({ state: 'visible' });
  assert.ok(await page.locator('#sync-finish').isHidden());
  await page.locator('#sync-join-key').fill('test-recovery-key');
  await page.locator('#sync-connect').click();
  await page.locator('#sync-workspace-setup').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#sync-join-key').inputValue(), '');
  await page.locator('#sync-disconnect').click();
  await page.waitForFunction(() => !document.querySelector('#sync-start').disabled);
  await page.locator('#sync-provider').selectOption('self-hosted');
  await page.locator('#sync-server').fill('http://insecure.example.com');
  await page.locator('#sync-start').click();
  assert.match(await page.locator('#sync-action-message').textContent(), /HTTPS/);
  await page.locator('#sync-server').fill('https://notes.example.com');
  await page.locator('#sync-account').click();
  assert.equal(await page.evaluate(() => window.openedURL), 'https://notes.example.com/');
  await page.locator('#sync-start').click();
  assert.deepEqual(await page.evaluate(() => window.calls.filter(c => c[0] === 'StartServer').at(-1)), ['StartServer', 'https://notes.example.com']);
  assert.equal(await page.evaluate(() => window.openedURL), 'https://notes.example.com/device?code=ABCD');
  await page.locator('#sync-workspace-setup').waitFor({ state: 'visible' });
  assert.ok(await page.locator('#sync-server').isDisabled());
  assert.ok(await page.locator('#sync-provider').isDisabled());
  console.log('PASS: hosted and self-hosted sign-in, URL validation, origin locking, automatic approval, workspace setup and disconnect.');
} finally { await browser.close(); }
