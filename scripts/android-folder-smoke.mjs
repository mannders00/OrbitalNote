// Disposable EMULATOR only. Install the current debug APK first. Uses the real
// Android picker/provider and native Go bridge, not a mocked storage adapter.
// PLAYWRIGHT_MODULE may name an absolute Playwright module. Run with Node.
import { execFileSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const adbPath = process.env.ADB || `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
const adb = (...args) => execFileSync(adbPath, ['-e', ...args], { encoding: 'utf8', timeout: 30000 }).trim();
const folder = process.env.ANDROID_TEST_FOLDER || 'OrbitalNote-saf-smoke';
assert.match(folder, /^OrbitalNote-saf-smoke[-\w]*$/);
const remote = `/sdcard/Documents/${folder}`, local = await mkdtemp(join(tmpdir(), 'orbital-saf-'));
const original = '#+TITLE: Android folder test\r\n* TODO Original 🌙\r\nUnchanged bytes.\n';
async function external(name, content) { const file = join(local, name); await writeFile(file, content); adb('push', file, remote + '/' + name); }
function nativeNodes() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/orbitalnote-window.xml');
  return [...adb('shell', 'cat', '/sdcard/orbitalnote-window.xml').matchAll(/<node\s+([^>]+)>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]])));
}
function tap(text) {
  const node = nativeNodes().find(n => n.text?.toLowerCase() === text.toLowerCase() || n['content-desc'] === text);
  assert.ok(node, `Native control not found: ${text}`);
  const [x1,y1,x2,y2] = node.bounds.match(/\d+/g).map(Number);
  adb('shell', 'input', 'tap', String((x1+x2)>>1), String((y1+y2)>>1));
}
async function connect() {
  const pid = adb('shell', 'pidof', 'com.orbitalnote.preview');
  adb('forward', 'tcp:9320', `localabstract:webview_devtools_remote_${pid}`);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9320');
  return [browser, browser.contexts()[0].pages()[0]];
}
adb('shell', 'mkdir', '-p', remote);
await external('Note.org', original);
let [browser, page] = await connect();
const api = (method, q = {}) => page.evaluate(async ({method,q}) => (await import('/api.js')).call(method,q), {method,q});
try {
  if (!process.env.PICKER_ALREADY_OPEN) {
    await page.evaluate(() => { window.folderPick = import('/api.js').then(m => m.chooseWorkspace()); });
    tap('Link a device folder');
  }
  let nodes = nativeNodes();
  // Fresh emulator pickers start at shared-storage root. A retained picker may
  // already be at our folder or its Documents parent.
  if (nodes.some(n => n.text === 'Documents')) tap('Documents');
  nodes = nativeNodes();
  if (nodes.some(n => n.text === folder && n['resource-id']?.includes('title'))) tap(folder);
  else if (nodes.some(n => n.text === folder)) {
    const matches = nodes.filter(n => n.text === folder);
    if (matches.some(n => n['class'] === 'android.widget.TextView' && n.bounds.match(/\d+/g).map(Number)[1] > 500)) tap(folder);
  }
  tap('USE THIS FOLDER'); tap('ALLOW');
  const selected = await page.evaluate(() => window.folderPick);
  assert.equal(selected.name, folder); assert.ok(selected.files.some(f => f.path === 'Note.org'));
  await page.reload();
  let state = await api('Status'); const key = state.key;
  const note = await api('Read', { id: state.id, path: 'Note.org' }); assert.equal(note.source, original);
  const saved = await api('Save', { id: state.id, path: 'Note.org', source: original + '* Saved in place\r\n', revision: note.revision });
  // exec-out preserves CRLF, unlike shell output processing.
  assert.equal(execFileSync(adbPath, ['-e','exec-out','cat',remote+'/Note.org'], {encoding:'utf8'}), saved.source);
  await external('Note.org', original + '* External edit\r\n');
  await assert.rejects(api('Save', { id: state.id, path: 'Note.org', source: '* stale edit', revision: saved.revision }), /changed|retained/i);
  await page.waitForFunction(async () => {
    const a = await import('/api.js'), s = await a.call('Status');
    return (await a.call('Search', {id:s.id,query:'External edit'})).length > 0;
  }, null, { timeout: 15000, polling: 500 });
  console.log('PASS real SAF picker, original-file writes, byte preservation, external edits and stale-save rejection');
  await api('Mkdir', {id:state.id,path:'sub'});
  await api('Save', {id:state.id,path:'sub/New.org',source:'* New\n',revision:''});
  await api('Rename', {id:state.id,path:'sub/New.org',to:'sub/Renamed.org'});
  await api('Rename', {id:state.id,path:'sub/Renamed.org',to:'Renamed.org'});
  const moved = await api('Read', {id:state.id,path:'Renamed.org'});
  await api('Remove', {id:state.id,path:'Renamed.org',revision:moved.revision});
  await api('Remove', {id:state.id,path:'sub',revision:''});
  await api('Save', {id:state.id,path:'.orbitalnote.org',source:'#+TITLE: settings\n#+begin_src json\n{"version":1,"groups":{}}\n#+end_src\n',revision:''});
  assert.ok((await api('Status')).files.some(f=>f.path==='.orbitalnote.org'));
  await assert.rejects(api('Read',{id:state.id,path:'../escape.org'}),/invalid/i);
  console.log('PASS provider create/rename/move/delete, hidden settings and path boundaries');
  await browser.close();
  adb('shell','am','force-stop','com.orbitalnote.preview');
  await external('Resumed.org','* Changed while stopped\n');
  adb('shell','am','start','-n','com.orbitalnote.preview/com.wails.app.OrbitalNoteActivity');
  // Wait for the native WebView socket rather than assuming a fixed boot time.
  for (let i=0;i<50;i++) { try { [browser,page]=await connect(); break; } catch(e) { if(i===49)throw e; await new Promise(r=>setTimeout(r,200)); } }
  await page.waitForFunction(() => document.querySelector('#workspace-name')?.textContent.includes('OrbitalNote-saf-smoke'));
  state=await api('Status'); assert.equal(state.key,key); assert.ok(state.files.some(f=>f.path==='Resumed.org'));
  assert.ok((await api('Read',{id:state.id,path:'Note.org'})).source.includes('External edit'));
  console.log('PASS persisted URI grant, cold restart, external changes while stopped and stable workspace identity');
} finally { await browser.close(); }
