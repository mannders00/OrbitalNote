// The only module aware of the native bridge. No frontend framework or bundler.
const native = !['http:', 'https:'].includes(location.protocol) || location.hostname === 'wails.localhost' || !!window.wails;
let runtime;
async function wails() { return runtime ||= await import('/wails/runtime.js'); }
const args = {
  Status: q => [], Open: q => [q.path], Read: q => [q.id, q.path],
  Image: q => [q.id, q.path],
  Save: q => [q.id, q.path, q.source, q.revision], Preview: q => [q.source],
  Mkdir: q => [q.id, q.path], Rename: q => [q.id, q.path, q.to],
  Remove: q => [q.id, q.path, q.revision], Search: q => [q.id, q.query],
  Backlinks: q => [q.id, q.path], Agenda: q => [q.id],
  Calendar: q => [q.id],
  Tags: q => [q.id],
  Edit: q => [q.source, q.line, q.operation, q.value || ''],
  Reschedule: q => [q.id, q.path, q.revision, q.start, q.end, q.value],
};
export async function call(method, q = {}) {
  if (native) return (await wails()).Call.ByName(`github.com/mannders00/OrbitalNote/internal/workspace.Service.${method}`, ...args[method](q));
  const response = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, ...q }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not complete operation');
  return result;
}
export async function chooseWorkspace() {
  if (!native) return null;
  return (await wails()).Call.ByName('main.Host.ChooseWorkspace');
}
export async function onClose(handler) { if (native) (await wails()).Events.On('workspace:request-close', handler); }
export async function quit() { if (native) return (await wails()).Call.ByName('main.Host.Quit'); }
export async function setNativeTheme(dark) {
  if (!native) return;
  const shade = dark ? 30 : 255;
  return (await wails()).Window.SetBackgroundColour(shade, shade, shade, 255);
}
export async function openExternal(url) {
  if (!/^(https?:|mailto:)/i.test(url)) throw new Error('Unsupported link scheme');
  if (native) return (await wails()).Call.ByName('main.Host.OpenURL', url);
  window.open(url, '_blank', 'noopener,noreferrer');
}
export { native };
