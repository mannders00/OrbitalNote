/* The Go runtime and the actual workspace engine live off the UI thread. */
importScripts('./wasm_exec.js');
const startup = { started: performance.now() };
const day = new Date();
globalThis.demoToday = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
globalThis.demoReady = () => {
  startup.engineReady = performance.now();
  const download = performance.getEntriesByName(new URL('./engine.wasm', location.href).href).at(-1);
  postMessage({ type: 'ready', timings: {
    wasmLoadAndCompileMs: startup.instantiated - startup.fetchStarted,
    engineInitMs: startup.engineReady - startup.instantiated,
    workerStartupMs: startup.engineReady - startup.started,
    ...(download ? { wasmDownloadMs: download.responseEnd - download.startTime, wasmTransferBytes: download.transferSize } : {}),
    streaming: startup.streaming,
  } });
};
globalThis.demoFailed = error => postMessage({ type: 'fatal', error: String(error) });
onmessage = ({ data }) => {
  if (!Number.isSafeInteger(data?.id) || typeof data.body !== 'string') return;
  try { postMessage({ id: data.id, body: globalThis.demoCall(data.body) }); }
  catch (error) { demoFailed(error.message); }
};
(async () => {
  const go = new Go();
  startup.fetchStarted = performance.now();
  const response = await fetch('./engine.wasm', { credentials: 'omit' });
  if (!response.ok) throw new Error('Could not download the demo engine');
  let result;
  startup.streaming = false;
  if (typeof WebAssembly.instantiateStreaming === 'function' && response.headers.get('Content-Type')?.split(';')[0].trim() === 'application/wasm') {
    try {
      result = await WebAssembly.instantiateStreaming(response.clone(), go.importObject);
      startup.streaming = true;
    } catch {
      // Retain the buffered path for browsers that expose but cannot use streaming.
    }
  }
  result ||= await WebAssembly.instantiate(await response.arrayBuffer(), go.importObject);
  const { instance } = result;
  startup.instantiated = performance.now();
  await go.run(instance);
  demoFailed('The demo engine stopped. Reset to try again.');
})().catch(error => demoFailed(error.message));
