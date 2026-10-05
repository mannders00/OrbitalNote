import { themes } from './appearance.js';
export const SETTINGS_FILE = 'OrbitalNote-settings.org';
const controls = {
  appearance: { 'org-theme': ['theme', themes.map(t => t[0])], 'org-theme-mode': ['theme-mode', ['system', 'light', 'dark']] },
  editor: { 'orbitalnote-preview-indent': ['preview-indent', ['true', 'false']], 'orbitalnote-hide-footer': ['hide-footer', ['true', 'false']], 'orbitalnote-monospace': ['monospace-mode', ['true', 'false']], 'orbitalnote-line-numbers': ['line-numbers', ['off', 'absolute', 'relative']] },
  calendar: { 'orbitalnote-calendar-time-format': ['calendar-time-format', ['12', '24']] },
};
export function decodeSettings(source) {
  if (source.length > 131072) throw new Error('Settings file is too large.');
  const match = /^#\+begin_src json\r?\n([\s\S]*?)\r?\n#\+end_src\s*$/im.exec(source);
  if (!match) throw new Error('Settings JSON block is missing.');
  const data = JSON.parse(match[1]);
  if (data.version !== 1 || !data.groups || typeof data.groups !== 'object' || Array.isArray(data.groups)) throw new Error('Unsupported settings format.');
  return data;
}
export function encodeSettings(data) { return '#+TITLE: OrbitalNote shared settings\n\n#+begin_src json\n' + JSON.stringify(data, null, 2) + '\n#+end_src\n'; }
export function validGroup(group, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [key, [, allowed]] of Object.entries(controls[group] || {})) if (allowed.includes(value[key])) result[key] = value[key];
  if (group === 'calendar' && value.colors && typeof value.colors === 'object' && !Array.isArray(value.colors)) {
    result.colors = Object.fromEntries(Object.entries(value.colors).filter(([tag, color]) => tag.length <= 100 && typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)).slice(0, 1000));
  }
  return result;
}

export function setupWorkspaceSettings(root, { workspace, call, colorsChanged }) {
  const status = root.querySelector('[data-settings-status]');
  let applying = false, writing = false, timer, identity = '', revision = '', version = -1, selectionGeneration = 0;
  const pending = new Set();
  const selectionKey = w => 'orbitalnote-settings-sync-' + w.key;
  const enabled = w => { try { return JSON.parse(localStorage.getItem(selectionKey(w)) || '[]').filter(group => controls[group]); } catch { return []; } };
  function local(group, w) {
    const values = {};
    for (const [key, [id]] of Object.entries(controls[group])) { const el = document.getElementById(id); values[key] = el.type === 'checkbox' ? String(el.checked) : el.value; }
    if (group === 'calendar') { try { values.colors = JSON.parse(localStorage.getItem('org-tag-colors-' + w.key) || '{}'); } catch { values.colors = {}; } }
    return validGroup(group, values);
  }
  function apply(group, data, w) {
    applying = true;
    try {
      const values = validGroup(group, data);
      for (const [key, [id]] of Object.entries(controls[group])) if (key in values) {
        const el = document.getElementById(id); if (el.type === 'checkbox') el.checked = values[key] === 'true'; else el.value = values[key];
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (group === 'calendar' && values.colors) { localStorage.setItem('org-tag-colors-' + w.key, JSON.stringify(values.colors)); colorsChanged(); }
    } finally { applying = false; }
  }
  async function read(w) {
    const note = await call('Read', { id: w.id, path: SETTINGS_FILE });
    return { data: decodeSettings(note.source), revision: note.revision };
  }
  async function write() {
    if (writing || !pending.size) return;
    const w = workspace(), groups = [...pending].filter(group => enabled(w).includes(group)); pending.clear();
    if (!w.id || !groups.length) return;
    const values = Object.fromEntries(groups.map(group => [group, local(group, w)]));
    writing = true;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        let current = { data: { version: 1, groups: {} }, revision: '' };
        if (attempt || w.files.some(f => f.path === SETTINGS_FILE)) current = await read(w);
        if (workspace().id !== w.id) return;
        const selectedValues = Object.fromEntries(Object.entries(values).filter(([group]) => enabled(w).includes(group)));
        if (!Object.keys(selectedValues).length) return;
        Object.assign(current.data.groups, selectedValues);
        try {
          await call('Save', { id: w.id, path: SETTINGS_FILE, source: encodeSettings(current.data), revision: current.revision });
          if (workspace().id !== w.id) return;
          revision = ''; version = -1; status.textContent = 'Shared settings saved. They travel with this workspace through Sync.'; break;
        } catch (error) { if (attempt) throw error; }
      }
    } catch (error) { status.textContent = 'Settings were not shared: ' + error.message; }
    finally { writing = false; if (pending.size) timer = setTimeout(write, 200); }
  }
  const changed = group => { if (applying || !enabled(workspace()).includes(group)) return; selectionGeneration++; pending.add(group); clearTimeout(timer); timer = setTimeout(write, 300); };
  root.closest('section').addEventListener('change', event => {
    for (const [group, fields] of Object.entries(controls)) if (Object.values(fields).some(([id]) => event.target.id === id)) changed(group);
  });
  for (const box of root.querySelectorAll('[data-sync-setting]')) box.addEventListener('change', async () => {
    const w = workspace(); if (!w.id) { box.checked = false; status.textContent = 'Open a workspace first.'; return; }
    const groups = [...root.querySelectorAll('[data-sync-setting]:checked')].map(el => el.dataset.syncSetting);
    localStorage.setItem(selectionKey(w), JSON.stringify(groups));
    selectionGeneration++;
    revision = ''; version = -1;
    await refresh();
  });
  async function refresh() {
    const w = workspace(); if (!w.id) return;
    if (identity !== w.key) { identity = w.key; revision = ''; version = -1; pending.clear(); clearTimeout(timer); }
    const groups = enabled(w), generation = selectionGeneration;
    for (const box of root.querySelectorAll('[data-sync-setting]')) box.checked = groups.includes(box.dataset.syncSetting);
    if (!groups.length || writing || pending.size || version === w.version) return;
    version = w.version;
    if (!w.files.some(f => f.path === SETTINGS_FILE)) { for (const group of groups) pending.add(group); await write(); return; }
    try {
      const next = await read(w); if (workspace().id !== w.id || generation !== selectionGeneration || writing || pending.size || next.revision === revision) return;
      revision = next.revision;
      for (const group of groups) {
        if (next.data.groups[group]) apply(group, next.data.groups[group], w);
        else pending.add(group);
      }
      status.textContent = 'Selected settings are shared with this workspace.';
      if (pending.size) await write();
    } catch (error) { status.textContent = 'Shared settings could not be loaded: ' + error.message; }
  }
  return { refresh, colorsChanged: () => changed('calendar') };
}
