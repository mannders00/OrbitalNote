// Loaded before the unchanged app entry point. Nothing is persisted or sent to /api.
function memoryStorage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(String(key)) ?? null,
    setItem: (key, value) => { if (String(value).length > 1_000_000) throw new DOMException('Demo storage limit', 'QuotaExceededError'); data.set(String(key), String(value)); },
    removeItem: key => data.delete(String(key)),
    clear: () => data.clear(),
  };
}
for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { value: memoryStorage() });
localStorage.setItem('org-right-sidebar', 'closed');
localStorage.setItem('org-theme', 'dark');
localStorage.setItem('org-theme-mode', 'system');

const loading = document.createElement('div');
loading.id = 'demo-loading';
loading.setAttribute('role', 'status');
loading.textContent = 'Opening your disposable workspace…';
document.body.append(loading);
let worker;
let sequence = 0, failed = false;
const pending = new Map();
const tellHost = (type, extra = {}) => {
  // Only status messages; the parent cannot read or write notes through this channel.
  if (parent !== window) parent.postMessage({ source: 'orbitalnote-demo', type, ...extra }, '*');
};
function fail(message) {
  if (failed) return;
  failed = true; worker?.terminate();
  for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error(message)); }
  pending.clear();
  loading.replaceChildren(document.createTextNode(message + ' '));
  const reset = document.createElement('button'); reset.textContent = 'Reset demo'; reset.onclick = () => location.reload();
  loading.append(reset); loading.hidden = false;
  tellHost('failed');
}
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => { fail('The demo took too long to load.'); reject(new Error('Demo startup timed out')); }, 60000);
  try { worker = new Worker(new URL('./worker.js', import.meta.url)); }
  catch (error) { clearTimeout(timer); fail('This browser could not start a demo worker.'); reject(error); return; }
  worker.onmessage = ({ data }) => {
    if (data.type === 'ready') { clearTimeout(timer); resolve(); return; }
    if (data.type === 'fatal') { clearTimeout(timer); fail(data.error); reject(new Error(data.error)); return; }
    const item = pending.get(data.id); if (!item) return;
    clearTimeout(item.timer); pending.delete(data.id); item.resolve(data.body);
  };
  worker.onerror = () => { clearTimeout(timer); fail('Could not start this browser demo.'); reject(new Error('Demo worker failed')); };
});
window.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (url.origin !== location.origin || url.pathname !== '/api' || options.method !== 'POST') {
    throw new Error('Network access is unavailable in this disposable demo.');
  }
  await ready;
  if (failed) throw new Error('Reset the demo to continue.');
  if (typeof options.body !== 'string' || options.body.length > 4 * 1024 * 1024 + 4096) throw new Error('Demo request is too large.');
  if (pending.size >= 32) throw new Error('The demo is busy. Please try again.');
  const id = ++sequence;
  const body = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => fail('That operation took too long. Reset the demo to continue.'), 20000);
    pending.set(id, { resolve, reject, timer }); worker.postMessage({ id, body: options.body });
  });
  const result = JSON.parse(body);
  return new Response(body, { status: result?.error ? 409 : 200, headers: { 'Content-Type': 'application/json' } });
};
// Native file access is absent; also prevent accidental browser file navigation.
document.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); }, true);
document.addEventListener('drop', e => { if (e.dataTransfer?.files.length) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (href.startsWith('#')) return;
  e.preventDefault();
  // Internal Org links still reach the app's own note-navigation handler.
  if (!a.closest('.ui-preview') || /^(?:https?:|mailto:|\/\/)/i.test(href)) e.stopImmediatePropagation();
}, true);
window.open = () => null;
// Refresh is the demo's discard action, even during the app's autosave debounce.
window.addEventListener('beforeunload', e => e.stopImmediatePropagation(), true);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.querySelector('dialog[open], [popover]:popover-open')) tellHost('escape');
}, true);
window.addEventListener('pagehide', () => worker?.terminate());
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

try {
  await ready;
  await import('./app.js');
  // Use the app's normal file-opening action, rather than a second UI implementation.
  const openWelcome = () => {
    const button = document.querySelector('#file-tree [data-open="Welcome.org"], #tree [data-open="Welcome.org"]');
    if (!button) return false;
    button.click(); return true;
  };
  const observer = new MutationObserver(() => { if (openWelcome()) observer.disconnect(); });
  if (!openWelcome()) { observer.observe(document.body, { childList: true, subtree: true }); setTimeout(() => observer.disconnect(), 10000); }
  document.getElementById('open-workspace').disabled = true;
  document.getElementById('open-workspace').title = 'Disposable demo workspace — refresh to reset';
  loading.hidden = true;
  document.documentElement.dataset.demoReady = 'true';
  tellHost('ready');
} catch (error) { fail('Could not open the demo. ' + error.message); }
