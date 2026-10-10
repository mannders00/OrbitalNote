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
export async function chooseWorkspace(reconnectOnly = false) {
  if (!native) return null;
  try { return await (await wails()).Call.ByName(reconnectOnly ? 'main.Host.ReconnectWorkspace' : 'main.Host.ChooseWorkspace'); }
  catch (error) { throw new Error((error.message || String(error)).replace(/^Binding call failed:\s*Bound method returned an error:\s*/i, '')); }
}
export async function onClose(handler) { if (native) (await wails()).Events.On('workspace:request-close', handler); }
export async function onCloseTab(handler) { if (native) (await wails()).Events.On('workspace:close-tab', handler); }
export async function quit() { if (native) return (await wails()).Call.ByName('main.Host.Quit'); }
export async function zoomNative(direction) { if (native) return (await wails()).Call.ByName('main.Host.Zoom', direction); }
export async function syncCall(method, ...args) {
  if (!native) throw new Error('Sync settings are available in the native desktop and Android apps.');
  if (!['Status', 'Start', 'Finish', 'Create', 'Connect', 'Recovery', 'Disconnect'].includes(method)) throw new Error('Unknown Sync action');
  return (await wails()).Call.ByName(`main.Host.Sync${method}`, ...args);
}
export async function setNativeTheme(dark) {
  if (!native) return;
  if (window.OrbitalNoteAndroid) {
    window.OrbitalNoteAndroid.setTheme(dark);
    return;
  }
  const shade = dark ? 30 : 255;
  return (await wails()).Window.SetBackgroundColour(shade, shade, shade, 255);
}
export async function openExternal(url) {
  if (!/^(https?:|mailto:)/i.test(url)) throw new Error('Unsupported link scheme');
  if (native && window.OrbitalNoteAndroid) {
    const error = window.OrbitalNoteAndroid.openURL(url);
    if (error) throw new Error(error);
    return;
  }
  if (native) return (await wails()).Call.ByName('main.Host.OpenURL', url);
  window.open(url, '_blank', 'noopener,noreferrer');
}
export { native };
