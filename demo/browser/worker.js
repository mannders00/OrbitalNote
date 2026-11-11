/* The Go runtime and the actual workspace engine live off the UI thread. */
importScripts('./wasm_exec.js');
const day = new Date();
globalThis.demoToday = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
globalThis.demoReady = () => postMessage({ type: 'ready' });
globalThis.demoFailed = error => postMessage({ type: 'fatal', error: String(error) });
onmessage = ({ data }) => {
  if (!Number.isSafeInteger(data?.id) || typeof data.body !== 'string') return;
  try { postMessage({ id: data.id, body: globalThis.demoCall(data.body) }); }
  catch (error) { demoFailed(error.message); }
};
(async () => {
  const go = new Go();
  const response = await fetch('./engine.wasm', { credentials: 'omit' });
  if (!response.ok) throw new Error('Could not download the demo engine');
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
  await go.run(instance);
  demoFailed('The demo engine stopped. Reset to try again.');
})().catch(error => demoFailed(error.message));
