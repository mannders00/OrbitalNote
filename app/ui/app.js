import { call, chooseWorkspace, native, onClose, quit, openExternal, setNativeTheme } from './api.js';
import { attachVi } from './vi.js';
import { escapeHTML as esc, command, replaceSelection, updateRaw } from './editor.js';
import { icon, mountIcons } from './icons.js';
import { TabLayout } from './tab-layout.js';
import { createEditor } from './vendor/editor.js';
import { taskDialog } from './task-dialog.js';
import { timeGrid } from './calendar.js';

let activeSurface = null, source = null, vi = null;
let documentSerial = 0;
const pageNames = { agenda: 'Agenda', calendar: 'Calendar', search: 'Search', tags: 'Tags', settings: 'Settings', welcome: 'Workspace' };
const pages = new Map(Object.keys(pageNames).map(id => [id, document.getElementById(id)]));
const $ = id => activeSurface?.querySelector(`[data-ui="${id}"]`) || document.getElementById(id) || pages.get(id) || [...pages.values()].map(page => page.querySelector(`#${id}`)).find(Boolean);
const documentTemplate = $('document');
documentTemplate.remove();
let restoringLayout = true;
const layout = new TabLayout($('tab-layout'), {
  activate: activateTab,
  close: id => run(() => id.startsWith('file:') ? closeTab(id.slice(5)) : closeViewTab(id))(),
  changed: saved => { if (!restoringLayout && workspace.key) localStorage.setItem('org-layout-' + workspace.key, JSON.stringify({ ...saved, modes: Object.fromEntries([...tabs].map(([path, t]) => [path, t.mode])) })); },
});
let workspace = { id: 0, version: 0, files: [] };
const tabs = new Map();
const pendingSaves = new Map();
let active = '', view = 'agenda', mode = 'edit', entries = [], tags = [], agendaFilter = 'today';
let calendarMode = 'month', calendarDate = new Date(), openSequence = 0;
let refreshing = false, searchTimer, noticeTimer, searchSequence = 0, paletteItems = [], paletteSelection = 0, paletteKind = 'commands';
const recent = [];
const narrowLayout = matchMedia('(max-width: 800px)');
let leftOpen = localStorage.getItem('org-left-sidebar') !== 'closed';
let rightOpen = localStorage.getItem('org-right-sidebar') !== 'closed';
let mobileLeftOpen = false, mobileRightOpen = false;
mountIcons();
for (const input of document.querySelectorAll('input, textarea')) {
  input.spellcheck = false; input.setAttribute('autocorrect', 'off'); input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocomplete', 'off');
}
const current = () => view === 'document' ? tabs.get(active) : undefined;
const dirty = t => t && t.buffer !== t.saved;
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => dateKey(new Date());
// Dates arriving from Go are validated civil dates. Construct at local noon for
// calendar navigation, never Date.parse(YYYY-MM-DD), which would imply UTC.
const civil = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const dateLabel = key => civil(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const empty = (title, text = '') => `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;
function notify(message, kind = 'info') {
  clearTimeout(noticeTimer);
  $('notice').textContent = String(message); $('notice').dataset.kind = kind; $('notice').hidden = !message;
  if (message && kind === 'info') noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 4000);
}
function fail(error) { console.error(error); notify(error.message || String(error), 'error'); }
function run(fn) { return (...args) => { try { return Promise.resolve(fn(...args)).catch(fail); } catch (error) { fail(error); } }; }
function listen(id, event, fn) { $(id).addEventListener(event, run(fn)); }

function updateSidebars() {
  const left = narrowLayout.matches ? mobileLeftOpen : leftOpen;
  const compact = activeSurface?.getBoundingClientRect().width < 760;
  const right = view === 'document' && (narrowLayout.matches || compact ? mobileRightOpen : rightOpen);
  $('sidebar').hidden = !left;
  if ($('context')) $('context').hidden = !right;
  if ($('context-scrim')) $('context-scrim').hidden = !right || !compact;
  $('panel-scrim').hidden = !narrowLayout.matches || (!left && !right);
  for (const [id, expanded, side] of [['menu', left, 'left'], ['context-toggle', right, 'right']]) {
    const button = $(id);
    const label = `${expanded ? 'Hide' : 'Show'} ${side} sidebar`;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  $('context-toggle').disabled = view !== 'document';
  if (view !== 'document') $('context-toggle').title = 'Open a note to show the right sidebar';
  if (!left && $('sidebar').contains(document.activeElement)) $('menu').focus();
  if (!right && $('context')?.contains(document.activeElement)) $('context-toggle').focus();
}
function toggleSidebar(side) {
  if (side === 'right' && view !== 'document') return;
  if (narrowLayout.matches || (side === 'right' && activeSurface?.getBoundingClientRect().width < 760)) {
    if (side === 'left') { mobileLeftOpen = !mobileLeftOpen; mobileRightOpen = false; }
    else { mobileRightOpen = !mobileRightOpen; mobileLeftOpen = false; }
  } else if (side === 'left') {
    leftOpen = !leftOpen; localStorage.setItem('org-left-sidebar', leftOpen ? 'open' : 'closed');
  } else {
    rightOpen = !rightOpen; localStorage.setItem('org-right-sidebar', rightOpen ? 'open' : 'closed');
  }
  updateSidebars();
}
function closeMobileSidebars() { mobileLeftOpen = false; mobileRightOpen = false; updateSidebars(); }
narrowLayout.addEventListener('change', closeMobileSidebars);

async function dialog(title, body, action = 'Continue') {
  const modal = $('modal');
  if (modal.open) return null;
  $('modal-title').textContent = title; $('modal-body').innerHTML = body; $('modal-submit').textContent = action;
  for (const input of $('modal-body').querySelectorAll('input, textarea')) { input.spellcheck = false; input.setAttribute('autocorrect', 'off'); input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocomplete', 'off'); }
  modal.returnValue = ''; modal.showModal();
  const input = modal.querySelector('input'); if (input) { input.focus(); input.select(); }
  return new Promise(resolve => modal.addEventListener('close', () => {
    resolve(modal.returnValue === 'ok' ? new FormData($('modal-form')) : null);
  }, { once: true }));
}
async function askText(title, label, value = '', action = 'Continue') {
  const data = await dialog(title, `<label>${esc(label)}<input name="value" required value="${esc(value)}"></label>`, action);
  return data?.get('value').trim() || null;
}
async function confirm(title, message, action) { return !!await dialog(title, `<p>${esc(message)}</p>`, action); }

function tabFrom(note, previous = {}) {
  const eol = note.source.includes('\r\n') && !note.source.replaceAll('\r\n', '').includes('\n') ? '\r\n' : '\n';
  const normalized = note.source.replace(/\r\n?/g, '\n');
  return { ...note, raw: note.source, buffer: normalized, saved: normalized, eol, position: previous.position || 0, scroll: previous.scroll || 0, mode: previous.mode || 'edit', surface: previous.surface, vi: previous.vi, conflict: false, saving: false };
}
function rememberPosition() { const t = current(); if (t && view === 'document') { t.position = source.selectionStart; t.scroll = source.scrollTop; } }
function renderTabs() {
  for (const [path, t] of tabs) {
    if (!t.surface) createDocumentSurface(path, t);
    const descriptor = { title: path.split('/').pop().replace(/\.org$/i, ''), icon: 'file', dirty: dirty(t), element: t.surface };
    const old = t.surface.dataset.path;
    if (old !== path) layout.rename('file:' + old, 'file:' + path, descriptor);
    t.surface.dataset.path = path;
    if (layout.tabs.has('file:' + path)) layout.tabs.set('file:' + path, descriptor);
    else layout.open('file:' + path, descriptor, false);
  }
  for (const id of [...layout.tabs.keys()]) if (id.startsWith('file:') && !tabs.has(id.slice(5))) layout.remove(id);
  layout.render(); layout.changed();
}
function createDocumentSurface(path, t) {
  const surface = documentTemplate.cloneNode(true);
  for (const el of [surface, ...surface.querySelectorAll('[id]')]) {
    el.dataset.ui = el.id; el.classList.add('ui-' + el.id); el.removeAttribute('id');
  }
  surface.dataset.path = path;
  surface.dataset.previewPrefix = `note-${++documentSerial}-`;
  const find = id => surface.querySelector(`[data-ui="${id}"]`);
  const editor = createEditor(surface.querySelector('.source-pane'));
  t.surface = surface; t.vi = attachVi(editor, find('vi-state'), value => askText('Find in note', 'Search text', value, 'Find'));
  t.vi.setEnabled($('vi-mode').checked);
  const focused = fn => run(e => { activateTab('file:' + surface.dataset.path); return fn(e); });
  const bind = (id, event, fn) => find(id).addEventListener(event, focused(fn));
  bind('preview-toggle', 'click', () => setMode(mode === 'edit' ? 'preview' : 'edit'));
  bind('save', 'click', save); bind('save-copy', 'click', saveCopy); bind('file-actions', 'click', fileActions);
  bind('reload-file', 'click', async () => {
    const path = active, t = current(), id = workspace.id;
    if (!await confirm('Reload from disk?', 'Your unsaved buffer will be discarded. Save a copy first to keep both versions.', 'Reload')) return;
    const note = await call('Read', { id, path });
    if (workspace.id !== id || tabs.get(path) !== t) return;
    tabs.set(path, tabFrom(note, t)); if (active === path && view === 'document') showDocument(); renderTabs();
  });
  bind('context-close', 'click', () => { toggleSidebar('right'); $('context-toggle').focus(); });
  bind('context-scrim', 'click', closeMobileSidebars);
  const observer = new ResizeObserver(() => {
    const compact = surface.getBoundingClientRect().width < 760;
    find('context').hidden = compact ? !(surface === activeSurface && mobileRightOpen) : !rightOpen;
    find('context-scrim').hidden = !compact || find('context').hidden;
    if (surface === activeSurface) updateSidebars();
  });
  observer.observe(surface); t.resizeObserver = observer;
  editor.addEventListener('editor-input', () => {
    const t = tabs.get(surface.dataset.path); if (!t) return;
    t.raw = updateRaw(t.raw, t.buffer, editor.value, t.eol); t.buffer = editor.value;
    updateStatus(t); renderTabs();
    clearTimeout(t.previewTimer); t.previewTimer = setTimeout(() => updatePreview(surface.dataset.path).catch(fail), 250);
    scheduleSave(t);
  });
  editor.addEventListener('scroll', () => syncEditorScroll(surface));
  for (const event of ['click', 'keyup', 'editor-selection']) editor.addEventListener(event, () => updateStatus(tabs.get(surface.dataset.path)));
  editor.addEventListener('task-toggle', run(async e => {
    const path = surface.dataset.path, t = tabs.get(path), buffer = t.buffer;
    const changed = await call('Edit', { source: buffer, line: e.detail.line, operation: 'complete' });
    if (tabs.get(path) !== t || t.buffer !== buffer) return;
    applySource(editor, buffer, changed);
  }));
  find('preview').addEventListener('click', focused(async e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) { find('preview').querySelector(`[id="${CSS.escape(href.slice(1))}"]`)?.scrollIntoView(); return; }
    if (/^(https?:|mailto:)/i.test(href)) { await openExternal(href); return; }
    await openNote(relativePath(href, surface.dataset.path));
  }));
  mountIcons(surface);
}
function activateTab(id) {
  if (view === 'document' && id === 'file:' + active && activeSurface === tabs.get(active)?.surface) return;
  rememberPosition();
  if (id.startsWith('file:')) {
    active = id.slice(5); view = 'document';
    const t = tabs.get(active); if (!t) return;
    setActiveSurface(t.surface); source = $('source'); vi = t.vi; mode = t.mode;
    showDocument();
  } else { view = id.slice(5); setActiveSurface(null); }
  document.querySelectorAll('#ribbon [data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
  closeMobileSidebars(); renderTree();
}
function setActiveSurface(surface) {
  if (activeSurface === surface) return;
  // Stable IDs refer to the focused document only; every other document uses
  // its own scoped data-ui elements, with no duplicate IDs across splits.
  if (activeSurface) {
    for (const el of [activeSurface, ...activeSurface.querySelectorAll('[data-ui]')]) el.removeAttribute('id');
    activeSurface.querySelector('.vi-cursor-layer')?.removeAttribute('id');
  }
  activeSurface = surface;
  if (surface) {
    for (const el of [surface, ...surface.querySelectorAll('[data-ui]')]) el.id = el.dataset.ui;
    surface.querySelector('.vi-cursor-layer').id = 'vi-cursor-layer';
  }
}
function closeViewTab(id) {
  layout.remove(id);
  if (!layout.tabs.size) { active = ''; view = 'welcome'; activeSurface = null; setView(workspace.id ? 'agenda' : 'welcome'); }
}
function renderTree() {
  const openFolders = new Set([...$('tree').querySelectorAll('details[open]')].map(e => e.dataset.path));
  const nodes = new Map([['', { folders: [], files: [] }]]);
  for (const f of workspace.files) {
    const parts = f.path.split('/'); parts.pop(); const parent = parts.join('/');
    if (!nodes.has(parent)) nodes.set(parent, { folders: [], files: [] });
    if (f.directory) { nodes.set(f.path, nodes.get(f.path) || { folders: [], files: [] }); nodes.get(parent).folders.push(f.path); }
    else nodes.get(parent).files.push(f.path);
  }
  const render = p => {
    const n = nodes.get(p); if (!n) return '';
    return n.folders.map(f => `<details data-path="${esc(f)}" ${openFolders.has(f) || active.startsWith(f + '/') ? 'open' : ''}><summary>${esc(f.split('/').pop())}<button class="icon-button folder-actions" data-folder="${esc(f)}" title="Folder actions" aria-label="Actions for ${esc(f)}">${icon('more')}</button></summary>${render(f)}</details>`).join('') + n.files.map(f => `<button data-open="${esc(f)}" title="${esc(f)}" class="${f === active && view === 'document' ? 'active' : ''}"><span class="file-name">${esc(f.split('/').pop().replace(/\.org$/i, ''))}</span></button>`).join('');
  };
  $('tree').innerHTML = render('') || empty(workspace.id ? 'No Org files' : 'No workspace open');
  $('tree').querySelectorAll('[data-open]').forEach(el => { el.draggable = true; el.dataset.movePath = el.dataset.open; });
  $('tree').querySelectorAll('summary').forEach(el => { el.draggable = true; el.dataset.movePath = el.parentElement.dataset.path; el.dataset.dropFolder = el.parentElement.dataset.path; });
  if (workspace.id) $('tree').insertAdjacentHTML('afterbegin', '<div class="tree-root" data-drop-folder="" title="Drop here to move to the workspace root">Workspace</div>');
}
function setView(next) {
  if (next === 'document') { renderTabs(); layout.select('file:' + active); }
  else layout.open('view:' + next, { title: pageNames[next], icon: next === 'welcome' ? 'folder' : next, element: pages.get(next) });
  if (next === 'search') $('search-input').focus();
}
async function openWorkspace() {
  if (movingFile) return;
  if ([...tabs.values()].some(t => dirty(t) || t.saving)) { notify('Wait for your edits to save, or close your edited tabs before switching workspaces.'); return; }
  let next;
  if (native) next = await chooseWorkspace();
  else { const path = await askText('Open workspace', 'Absolute path to an existing folder', '', 'Open folder'); if (!path) return; next = await call('Open', { path }); }
  if (!next?.id || next.id === workspace.id) return;
  restoringLayout = true; for (const t of tabs.values()) disposeDocument(t); tabs.clear(); layout.reset(); active = ''; activeSurface = null; view = 'agenda'; openSequence++; workspace = next; await refreshData(); await restoreLayout();
  loadRecent();
}
async function refreshData() {
  const id = workspace.id;
  if (!id) return;
  const [data, tagData] = await Promise.all([call('Calendar', { id }), call('Tags', { id })]); if (id !== workspace.id) return; entries = data; tags = tagData;
  $('workspace-name').textContent = workspace.name;
  $('agenda-count').textContent = entries.filter(e => !e.done && e.stamp.date === today()).length || '';
  $('today-label').textContent = dateLabel(today());
  renderTree(); renderAgenda(); renderCalendar(); renderTags();
}
async function refresh() {
  if (movingFile) return;
  if (refreshing) return; refreshing = true;
  try {
    const next = await call('Status');
    if (next.id !== workspace.id) return; // Workspace changes are coordinated by openWorkspace.
    if (next.version === workspace.version) return;
    workspace = next;
    if (next.warnings.length) notify(next.warnings.join('\n'));
    await refreshData();
    for (const [p, t] of tabs) {
      if (t.saving) continue;
      try {
        const note = await call('Read', { id: workspace.id, path: p });
        if (tabs.get(p) !== t || t.saving) continue;
        if (note.revision !== t.revision) {
          if (dirty(t)) t.conflict = true;
          else { if (active === p && view === 'document') rememberPosition(); const updated = tabFrom(note, t); tabs.set(p, updated); renderDocument(updated); if (active === p && view === 'document') showDocument(); }
        }
      } catch { if (tabs.get(p) === t) t.conflict = true; }
    }
    renderTabs(); for (const t of tabs.values()) updateStatus(t);
  } finally { refreshing = false; }
}
async function openNote(path, line) {
  rememberPosition(); const request = ++openSequence, id = workspace.id;
  if (!tabs.has(path)) {
    const note = await call('Read', { id, path });
    if (request !== openSequence || id !== workspace.id) return;
    tabs.set(path, tabFrom(note));
  }
  renderTabs(); layout.select('file:' + path);
  const i = recent.indexOf(path); if (i >= 0) recent.splice(i, 1); recent.unshift(path);
  localStorage.setItem('org-recent-' + workspace.key, JSON.stringify(recent.slice(0, 30)));
  if (line) {
    const pos = source.value.split('\n').slice(0, line - 1).reduce((n, s) => n + s.length + 1, 0);
    setMode('edit'); source.focus(); source.setSelectionRange(pos, pos); vi.reveal(); syncScroll();
  }
}
function showDocument() {
  const t = current(); if (!t) return;
  renderDocument(t);
  $('document-name').textContent = active.replace(/\.org$/i, '');
  renderContext(t); updateStatus(); setMode(mode);
  const path = active, id = workspace.id;
  call('Backlinks', { id, path }).then(results => { if (active !== path || workspace.id !== id || !activeSurface) return; setHTML($('backlinks'), results.map(r => `<button data-open="${esc(r.path)}" data-line="${r.line}">${esc(r.path)}</button>`).join('') || '<p class="empty">No backlinks</p>'); }).catch(fail);
}
function renderDocument(t) {
  if (!t.surface) return;
  const editor = t.surface.querySelector('[data-ui="source"]');
  if (editor.value !== t.buffer) { editor.value = t.buffer; editor.setSelectionRange(t.position, t.position); editor.scrollTop = t.scroll; t.vi.reset(); }
  setPreview(t, t.html);
  updateMode(t);
   const compact = narrowLayout.matches || t.surface.getBoundingClientRect().width < 760;
   t.surface.querySelector('[data-ui="context"]').hidden = compact ? !(t.surface === activeSurface && mobileRightOpen) : !rightOpen;
   t.surface.querySelector('[data-ui="context-scrim"]').hidden = !compact || t.surface.querySelector('[data-ui="context"]').hidden;
  t.surface.querySelector('[data-ui="document-name"]').textContent = t.surface.dataset.path.replace(/\.org$/i, '');
  renderContext(t, t.surface);
  syncEditorScroll(t.surface); updateStatus(t);
  if (t.mode === 'preview') hydrateImages(t);
}
function renderContext(doc, surface = activeSurface) {
  if (!surface) return;
  setHTML(surface.querySelector('[data-ui="outline"]'), doc.headings.map(h => `<button data-jump="${h.line}" style="padding-left:${8 + Math.min(h.level - 1, 6) * 9}px">${esc(h.title)}</button>`).join('') || '<p class="empty">No headings</p>');
  setHTML(surface.querySelector('[data-ui="properties"]'), doc.headings.flatMap(h => Object.entries(h.properties).map(([k, v]) => `<div><strong>${esc(k)}</strong> ${esc(v)}</div>`)).join('') || '<span>No properties</span>');
}
function setHTML(element, html) { if (element.renderedHTML !== html) { element.innerHTML = html; element.renderedHTML = html; } }
function setPreview(t, html) {
  const preview = t.surface.querySelector('[data-ui="preview"]'), prefix = t.surface.dataset.previewPrefix;
  if (preview.renderedHTML === html) return;
  preview.renderedHTML = html;
  preview.innerHTML = html;
  // Org headings use document-local IDs. Namespace them when several notes
  // share a window, including their in-document links.
  for (const el of preview.querySelectorAll('[id]')) el.id = prefix + el.id;
  for (const link of preview.querySelectorAll('a[href^="#"]')) link.setAttribute('href', '#' + prefix + link.getAttribute('href').slice(1));
}
function updateStatus(t = current()) {
  if (!t?.surface) return;
  const find = id => t.surface.querySelector(`[data-ui="${id}"]`), editor = find('source');
  find('save-state').textContent = t.saving ? 'Saving…' : t.conflict ? 'External change · buffer preserved' : t.saveError ? 'Auto-save failed · edits retained' : dirty(t) ? 'Waiting to save…' : 'Saved to disk';
  find('save').disabled = !dirty(t) || t.saving || t.conflict;
  find('conflict').hidden = !t.conflict;
  const before = editor.value.slice(0, editor.selectionStart).split('\n');
  find('cursor').textContent = `Ln ${before.length}, Col ${before.at(-1).length + 1}`;
}
function syncEditorScroll(surface) { /* The rich editor owns wrapping, highlighting and scrolling. */ }
function syncScroll() { if (activeSurface) syncEditorScroll(activeSurface); }
function setMode(next) {
  const t = current(); if (!t) return;
  mode = t.mode = next === 'preview' ? 'preview' : 'edit'; updateMode(t);
  if (mode === 'edit') source.refresh();
  if (mode === 'preview') { setPreview(t, t.html); hydrateImages(t); if (dirty(t)) updatePreview(active).catch(fail); }
  layout.changed();
}
function updateMode(t) {
  t.surface.querySelector('[data-ui="panes"]').dataset.mode = t.mode;
  const toggle = t.surface.querySelector('[data-ui="preview-toggle"]'), label = t.mode === 'edit' ? 'Read preview' : 'Edit source';
  if (toggle.dataset.renderedMode === t.mode) return;
  toggle.dataset.renderedMode = t.mode;
  toggle.innerHTML = icon(t.mode === 'edit' ? 'book' : 'pencil'); toggle.title = label; toggle.setAttribute('aria-label', label); toggle.setAttribute('aria-pressed', String(t.mode === 'preview'));
}
async function updatePreview(path = active) {
  const t = tabs.get(path); if (!t) return;
  const seq = t.previewSequence = (t.previewSequence || 0) + 1, buffer = t.buffer;
  const doc = await call('Preview', { source: buffer });
  if (seq !== t.previewSequence || t.buffer !== buffer || tabs.get(path) !== t) return;
  t.html = doc.html; t.headings = doc.headings;
  setPreview(t, doc.html); hydrateImages(t); renderContext(doc, t.surface); if (doc.warning) notify(doc.warning);
}
function relativePath(target, path = active) {
  const parts = path.split('/'); parts.pop();
  target = decodeURIComponent(target.replace(/^file:/, '').split('::')[0]);
  if (target.startsWith('/') || target.includes('\\') || /^[a-z]+:/i.test(target)) throw new Error('Link must stay inside the workspace');
  for (const p of target.split('/')) { if (p === '..') { if (!parts.length) throw new Error('Link leaves the workspace'); parts.pop(); } else if (p !== '.' && p) parts.push(p); }
  return parts.join('/');
}
function hydrateImages(t = current()) {
  if (!t?.surface) return;
  for (const placeholder of t.surface.querySelectorAll('[data-org-image]')) {
    let path; try { path = relativePath(placeholder.dataset.orgImage, t.surface.dataset.path); } catch { continue; }
    call('Image', { id: workspace.id, path }).then(data => {
      if (!placeholder.isConnected) return;
      const image = document.createElement('img'); image.src = data; image.alt = placeholder.dataset.alt || path; image.loading = 'lazy'; placeholder.replaceWith(image);
    }).catch(error => { placeholder.textContent = `Image unavailable: ${error.message}`; });
  }
}
function scheduleSave(t) {
  clearTimeout(t.saveTimer);
  t.saveTimer = setTimeout(() => save(t.surface.dataset.path).catch(fail), 600);
}
async function save(path = active) {
  // Click handlers pass an Event; keyboard commands and timers pass a path.
  if (typeof path !== 'string') path = active;
  if (pendingSaves.has(path)) { await pendingSaves.get(path); return save(path); }
  const pending = saveNote(path); pendingSaves.set(path, pending);
  try { await pending; } finally { if (pendingSaves.get(path) === pending) pendingSaves.delete(path); }
}
async function saveNote(path) {
  if (movingFile) { notify('Wait for the file move to finish.'); return; }
  const t = tabs.get(path), id = workspace.id;
  if (!t || !dirty(t) || t.saving) return;
  if (t.conflict) { notify('Save a copy or reload the disk version to resolve this conflict.'); return; }
  clearTimeout(t.saveTimer);
  const buffer = t.buffer, raw = t.raw; t.saving = true; t.saveError = false; updateStatus(t);
  try {
    const note = await call('Save', { id, path, source: raw, revision: t.revision });
    if (workspace.id !== id || tabs.get(path) !== t) return;
    t.revision = note.revision; t.saved = buffer; t.conflict = false;
    if (t.buffer === buffer) { t.html = note.html; t.headings = note.headings; setPreview(t, t.html); renderContext(t, t.surface); if (t.mode === 'preview') hydrateImages(t); }
    notify(''); await refreshData();
  } catch (err) { t.saveError = true; if (String(err).includes('changed on disk')) t.conflict = true; throw err; }
  finally { t.saving = false; renderTabs(); updateStatus(t); if (!t.saveError && !t.conflict && tabs.get(path) === t && dirty(t)) scheduleSave(t); }
}
async function closeTab(path) {
  const t = tabs.get(path); if (t?.saving) return;
  if (dirty(t) && !await confirm('Close unsaved note?', `Discard your unsaved edits to ${path}?`, 'Discard edits')) return;
  disposeDocument(t); tabs.delete(path); layout.remove('file:' + path);
  if (!layout.tabs.size) { active = ''; view = 'agenda'; activeSurface = null; setView('agenda'); }
  renderTabs();
}
function disposeDocument(t) { clearTimeout(t?.previewTimer); clearTimeout(t?.saveTimer); t?.resizeObserver?.disconnect(); t?.vi?.dispose(); t?.surface?.querySelector('[data-ui="source"]')?.dispose(); }
async function createFile() {
  const path = await askText('New note', 'Workspace-relative path', 'untitled.org', 'Create note'); if (!path) return;
  await call('Save', { id: workspace.id, path, source: '', revision: '' }); workspace = await call('Status'); await refreshData(); await openNote(path);
}
async function saveCopy() {
  const t = current(); if (!t) return;
  const path = await askText('Save a separate copy', 'Workspace-relative .org path', active.replace(/\.org$/i, '-conflict.org'), 'Save copy'); if (!path) return;
  await call('Save', { id: workspace.id, path, source: t.raw, revision: '' }); workspace = await call('Status'); await refreshData(); await openNote(path);
}
async function fileActions() {
  const data = await dialog('File actions', '<label>Action<select name="action"><option value="rename">Rename or move…</option><option value="copy">Save a copy…</option><option value="delete">Delete file…</option></select></label>');
  if (!data) return; const action = data.get('action'), t = current(), path = active;
  if (action === 'copy') return saveCopy();
  if (dirty(t) || t.saving) { notify('Save your edits before renaming or deleting this file.'); return; }
  if (action === 'rename') {
    const to = await askText('Rename or move note', 'Destination path inside this workspace', path, 'Move note'); if (!to || to === path) return;
    await call('Rename', { id: workspace.id, path, to }); tabs.delete(path); t.path = to; tabs.set(to, t); active = to; showDocument(); renderTabs();
  } else if (await confirm('Delete note?', `${path} will be permanently removed from disk.`, 'Delete note')) {
    await call('Remove', { id: workspace.id, path, revision: t.revision }); tabs.delete(path); active = ''; setView('agenda');
  }
  workspace = await call('Status'); await refreshData(); renderTree();
}
async function folderActions(path) {
  if ([...tabs].some(([p,t]) => p.startsWith(path + '/') && (dirty(t) || t.saving))) { notify('Save edits in this folder before moving it.'); return; }
  const data = await dialog('Folder actions', '<label>Action<select name="action"><option value="rename">Rename or move…</option><option value="delete">Delete empty folder…</option></select></label>');
  if (!data) return;
  if (data.get('action') === 'rename') {
    const to = await askText('Rename or move folder', 'Destination path inside this workspace', path, 'Move folder'); if (!to || to === path) return;
    await call('Rename', { id: workspace.id, path, to });
    for (const [p,t] of [...tabs]) if (p.startsWith(path + '/')) { const next = to + p.slice(path.length); tabs.delete(p); t.path = next; tabs.set(next,t); if (active === p) active = next; }
    if (view === 'document') showDocument(); renderTabs();
  } else if (await confirm('Delete empty folder?', `Remove ${path}? Folders containing files will not be deleted.`, 'Delete folder')) {
    await call('Remove', { id: workspace.id, path, revision: '' });
  }
  workspace = await call('Status'); await refreshData();
}

function agendaMatches(e) {
  const q = $('agenda-query').value.trim().toLowerCase(), kind = $('kind-filter').value;
  return (!kind || kind === e.stamp.kind) && (!q || [e.path, e.title, e.state, ...e.tags, ...(e.fileTags || [])].join(' ').toLowerCase().includes(q));
}
// Stable defaults and workspace-local overrides; colors never modify Org source.
const tagPalette = [
  ['Blue', '#75adf5'], ['Teal', '#66bcb3'], ['Green', '#8cba80'], ['Gold', '#d3b16c'],
  ['Orange', '#d69b75'], ['Rose', '#cd879b'], ['Violet', '#aa96d5'], ['Slate', '#97a9bd'],
];
function tagColor(name) {
  let overrides = {};
  try { overrides = JSON.parse(localStorage.getItem('org-tag-colors-' + workspace.key) || '{}') || {}; } catch {}
  const saved = overrides[name];
  if (tagPalette.some(([, color]) => color === saved)) return saved;
  let hash = 0; for (const ch of name) hash = (Math.imul(hash, 31) + ch.codePointAt(0)) >>> 0;
  return tagPalette[hash % tagPalette.length][1];
}
function entryColorStyle(e) {
  const tag = e.tags[0] || e.fileTags?.[0];
  return tag ? `style="--tag-color:${tagColor(tag)}" data-color-tag="${esc(tag)}"` : '';
}
function entryHTML(e) {
  return `<button class="agenda-entry ${esc(e.stamp.kind)}" ${entryColorStyle(e)} data-open="${esc(e.path)}" data-line="${e.line}"><span class="entry-mark">${icon(e.stamp.kind === 'deadline' ? 'flag' : e.state ? 'square' : 'circle')}</span><span class="entry-main"><strong>${esc(e.title)}</strong><small>${esc(e.path)}${e.state ? ' · ' + esc(e.state) : ''}</small></span>${[...new Set([...e.tags, ...(e.fileTags || [])])].slice(0, 2).map(t => `<span class="entry-tag" style="--tag-color:${tagColor(t)}">${esc(t)}</span>`).join('')}<span class="entry-date">${esc(e.stamp.time || (e.stamp.date ? 'All day' : 'Unscheduled'))}<br><small>${esc(e.stamp.kind)}${e.stamp.repeater ? ' · ' + esc(e.stamp.repeater) : ''}</small></span></button>`;
}
function renderAgenda() {
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === agendaFilter));
  const now = today(); const groups = new Map();
  for (const e of entries.filter(e => !e.done && agendaMatches(e))) {
    const d = e.stamp.date;
    if (agendaFilter === 'today' && d !== now && !(d && d < now && ['scheduled', 'deadline'].includes(e.stamp.kind))) continue;
    if (agendaFilter === 'upcoming' && (!d || d < now)) continue;
    if (agendaFilter === 'overdue' && !(d && d < now && ['scheduled', 'deadline'].includes(e.stamp.kind))) continue;
    const key = !d ? 'Unscheduled' : d < now && ['scheduled', 'deadline'].includes(e.stamp.kind) ? 'Overdue' : d === now ? 'Today' : dateLabel(d);
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(e);
  }
  $('agenda-list').innerHTML = [...groups].map(([label, items]) => `<section class="agenda-group ${label === 'Overdue' ? 'overdue' : ''}"><h2>${esc(label)} <small>${items.length}</small></h2>${items.map(entryHTML).join('')}</section>`).join('') || empty('No tasks match this view');
}
function dayEntries(key) { return entries.filter(e => e.stamp.date && e.stamp.date <= key && (e.stamp.endDate || e.stamp.date) >= key); }
function monthGrid(year, month) {
  const first = new Date(year, month, 1, 12), start = new Date(first); start.setDate(1 - (first.getDay() + 6) % 7);
  let html = '<div class="month-grid">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="weekday">${d}</div>`).join('');
  const weeks = Math.ceil(((first.getDay() + 6) % 7 + new Date(year, month + 1, 0).getDate()) / 7);
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const key = dateKey(d);
    html += `<div class="calendar-cell ${d.getMonth() !== month ? 'outside' : ''} ${key === today() ? 'is-today' : ''}" data-drop-date="${key}"><button class="day-number" data-capture="${key}" title="Create task on ${key}">${d.getDate()}</button>${dayEntries(key).map(e => `<button class="calendar-event ${esc(e.stamp.kind)} ${e.done ? 'completed' : ''}" ${entryColorStyle(e)} draggable="${!e.stamp.repeater && !e.stamp.endDate}" data-entry="${entries.indexOf(e)}" data-open="${esc(e.path)}" data-line="${e.line}" title="${esc(e.title)}">${esc(e.stamp.time || '')}${e.stamp.endTime ? '–' + esc(e.stamp.endTime) : ''} ${esc(e.title)}</button>`).join('')}</div>`;
  }
  return html + '</div>';
}
function renderCalendar() {
  document.querySelectorAll('[data-calendar]').forEach(b => b.classList.toggle('active', b.dataset.calendar === calendarMode));
  const y = calendarDate.getFullYear(), m = calendarDate.getMonth();
  $('calendar-title').textContent = calendarMode === 'year' ? String(y) : calendarMode === 'day' ? dateLabel(dateKey(calendarDate)) : calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  if (calendarMode === 'month') { $('calendar-grid').innerHTML = monthGrid(y, m); return; }
  if (calendarMode === 'year') {
    let html = '<div class="year-grid">';
    for (let month = 0; month < 12; month++) {
      const first = new Date(y, month, 1, 12), blank = (first.getDay() + 6) % 7;
      html += `<section class="mini-month"><h3 data-month="${month}">${first.toLocaleDateString(undefined, { month: 'long' })}</h3><div class="mini-grid">${'<span></span>'.repeat(blank)}`;
      for (let d = 1; d <= new Date(y, month + 1, 0).getDate(); d++) { const key = dateKey(new Date(y, month, d, 12)); html += `<button data-day="${key}" class="${dayEntries(key).length ? 'has-events' : ''}">${d}</button>`; }
      html += '</div></section>';
    }
    $('calendar-grid').innerHTML = html + '</div>'; return;
  }
  const start = new Date(calendarDate); if (calendarMode === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  $('calendar-grid').innerHTML = timeGrid(start, calendarMode === 'week' ? 7 : 1, entries, entryColorStyle);
}
function shiftCalendar(delta) {
  if (calendarMode === 'month') calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + delta, 1, 12);
  else if (calendarMode === 'year') calendarDate = new Date(calendarDate.getFullYear() + delta, 0, 1, 12);
  else calendarDate.setDate(calendarDate.getDate() + delta * (calendarMode === 'week' ? 7 : 1));
  renderCalendar();
}
async function capture(date = today(), time = '') {
  const files = workspace.files.filter(f => !f.directory);
  const data = await taskDialog(dialog, { date, time, path: files.some(f => f.path === 'inbox.org') ? 'inbox.org' : files[0]?.path || 'inbox.org' });
  if (!data) return;
  const path = data.get('path').trim();
  if (dirty(tabs.get(path))) { notify('Save your open edits to this file before capturing a task into it.'); return; }
  let note = { source: '', revision: '' };
  if (workspace.files.some(f => f.path === path)) note = await call('Read', { id: workspace.id, path });
  const eol = note.source.includes('\r\n') ? '\r\n' : '\n';
  const addition = `${note.source && !note.source.endsWith('\n') ? eol : ''}${eol}* ${data.get('title').trim()}${eol}`;
  const source = note.source + addition, line = source.split('\n').length - 1;
  const updatedSource = await call('Edit', { source, line, operation: 'task', value: JSON.stringify(taskValues(data)) });
  const saved = await call('Save', { id: workspace.id, path, source: updatedSource, revision: note.revision });
  const tab = tabs.get(path);
  if (tab) { if (dirty(tab) || tab.saving) tab.conflict = true; else { const updated = tabFrom(saved, tab); tabs.set(path, updated); renderDocument(updated); } }
  renderTabs();
  workspace = await call('Status'); await refreshData();
  notify(`Task saved to ${path}.`);
}
function taskValues(data) { return { title: data.get('title').trim(), date: data.get('date'), time: data.get('time'), endTime: data.get('endTime'), kind: data.get('kind') }; }
function applySource(editor, before, after) {
  let start = 0, end = before.length, changedEnd = after.length;
  while (start < end && start < changedEnd && before[start] === after[start]) start++;
  while (end > start && changedEnd > start && before[end - 1] === after[changedEnd - 1]) { end--; changedEnd--; }
  replaceSelection(editor, after.slice(start, changedEnd), start, end);
}
async function editTaskAtCursor(kindOverride) {
  const t = current(), editor = source, path = active, buffer = t.buffer;
  const line = buffer.slice(0, editor.selectionStart).split('\n').length;
  const doc = await call('Preview', { source: buffer });
  const heading = doc.headings.filter(h => h.line <= line).at(-1);
  if (!heading) { notify('Place the cursor inside a heading to create a task.'); return; }
  let title = buffer.split('\n')[heading.line - 1].replace(/^\*+\s+/, '');
  if (heading.state && title.startsWith(heading.state + ' ')) title = title.slice(heading.state.length + 1);
  title = title.replace(/^\[#[^\]]+\]\s+/, '').replace(/\s+:[\w@#%:]+:\s*$/, '');
  const stamp = heading.dates.find(st => st.kind === 'scheduled' || st.kind === 'deadline');
  const data = await taskDialog(dialog, { editing: true, title, path, date: stamp?.date || '', time: stamp?.time || '', endTime: stamp?.endTime || '', kind: kindOverride || stamp?.kind || 'scheduled' });
  if (!data) return;
  if (tabs.get(path) !== t || t.buffer !== buffer) { notify('This heading changed while the task dialog was open. Please try again.'); return; }
  const changed = await call('Edit', { source: buffer, line: heading.line, operation: 'task', value: JSON.stringify({ ...taskValues(data), previousKind: stamp?.kind }) });
  if (tabs.get(path) !== t || t.buffer !== buffer) return;
  applySource(editor, buffer, changed);
}
async function search() {
  const seq = ++searchSequence, query = $('search-input').value, id = workspace.id;
  const results = await call('Search', { id, query }); if (seq !== searchSequence || id !== workspace.id) return;
  $('search-results').innerHTML = results.map(r => `<button class="search-result" data-open="${esc(r.path)}" data-line="${r.line}"><strong>${esc(r.path)} · line ${r.line}</strong><span>${esc(r.text)}</span></button>`).join('') || empty(query ? 'No results' : 'Search filenames and file contents');
}
function renderTags() {
  $('tag-list').innerHTML = tags.map(({ name, count }) => `<div class="tag-row"><button class="tag-button" style="--tag-color:${tagColor(name)}" data-tag="${esc(name)}">#${esc(name)} <small>${count}</small></button><div class="tag-swatches" role="group" aria-label="Color for ${esc(name)}">${tagPalette.map(([label, color]) => `<button class="tag-swatch" style="--swatch:${color}" data-color-name="${esc(name)}" data-color="${color}" title="${label}" aria-label="${label} for ${esc(name)}" aria-pressed="${tagColor(name) === color}"></button>`).join('')}</div></div>`).join('') || empty('No tags');
}
function loadRecent() { recent.length = 0; try { const saved = JSON.parse(localStorage.getItem('org-recent-' + workspace.key) || '[]'); if (Array.isArray(saved)) recent.push(...saved.filter(p => typeof p === 'string').slice(0, 30)); } catch { /* UI preferences are disposable. */ } }

async function editorCommand(name) {
  if (!current() || view !== 'document') { notify('Open a document to use editing commands.'); return; }
  setMode('edit');
  if (name === 'todo' || name === 'schedule' || name === 'deadline') return editTaskAtCursor(name === 'schedule' ? 'scheduled' : name === 'deadline' ? 'deadline' : undefined);
  let extra = '';
  if (name === 'timestamp' || name === 'schedule' || name === 'deadline') {
    const data = await dialog(name === 'timestamp' ? 'Insert timestamp' : name === 'schedule' ? 'Schedule heading' : 'Set deadline', `<label>Date<input type="date" name="date" value="${today()}" required></label>`, 'Insert');
    if (!data) return; extra = data.get('date');
  }
  if (name === 'link') { extra = await askText('Insert link', 'URL or file:relative/path.org', 'https://'); if (!extra) return; }
  if (['promote', 'demote', 'todo', 'move-up', 'move-down', 'schedule', 'deadline'].includes(name)) {
    const t = current(), buffer = t.buffer, path = active;
    const line = source.value.slice(0, source.selectionStart).split('\n').length;
    const changed = await call('Edit', { source: buffer, line, operation: name, value: extra });
    if (active !== path || tabs.get(path) !== t || t.buffer !== buffer) { notify('The buffer changed while the command ran. Please try again.'); return; }
    let start = 0, end = buffer.length, changedEnd = changed.length;
    while (start < end && start < changedEnd && buffer[start] === changed[start]) start++;
    while (end > start && changedEnd > start && buffer[end - 1] === changed[changedEnd - 1]) { end--; changedEnd--; }
    replaceSelection(source, changed.slice(start, changedEnd), start, end); return;
  }
  command(source, name, extra);
}
const commands = [
  ['Toggle left sidebar', '⌘ / Ctrl Shift L', () => toggleSidebar('left')], ['Toggle right sidebar', '⌘ / Ctrl Shift R', () => toggleSidebar('right')],
  ['New note', '⌘ / Ctrl N', createFile], ['Open workspace', '', openWorkspace], ['Save note', '⌘ / Ctrl S', save],
  ['Go to agenda', '', () => setView('agenda')], ['Go to calendar', '', () => setView('calendar')], ['Search workspace', '', () => setView('search')],
  ['Create heading', 'Alt Enter', () => editorCommand('heading')], ['Promote heading', 'Alt ←', () => editorCommand('promote')], ['Demote heading', 'Alt →', () => editorCommand('demote')],
  ['Move heading up', 'Alt ↑', () => editorCommand('move-up')], ['Move heading down', 'Alt ↓', () => editorCommand('move-down')],
  ['Toggle TODO', 'Alt T', () => editorCommand('todo')], ['Toggle checkbox', '', () => editorCommand('checkbox')],
  ['Insert timestamp', '', () => editorCommand('timestamp')], ['Schedule heading', '', () => editorCommand('schedule')], ['Set deadline', '', () => editorCommand('deadline')], ['Insert link', '', () => editorCommand('link')],
  ['Indent line', 'Tab', () => editorCommand('indent')], ['Outdent line', 'Shift Tab', () => editorCommand('outdent')], ['Preview document', '', () => setMode('preview')], ['Edit source', '', () => setMode('edit')], ['Settings', '', () => setView('settings')],
];
function fuzzy(text, query) { let i = 0; for (const c of text.toLowerCase()) if (c === query[i]) i++; return i === query.length; }
function openPalette(kind) { paletteKind = kind; $('palette-input').value = ''; $('palette-input').placeholder = kind === 'files' ? 'Open a file…' : 'Find a command…'; $('palette').showModal(); $('palette-input').focus(); renderPalette(); }
function renderPalette() {
  const q = $('palette-input').value.toLowerCase().trim();
  const items = paletteKind === 'files' ? workspace.files.filter(f => !f.directory).sort((a, b) => (recent.indexOf(a.path) < 0 ? 999 : recent.indexOf(a.path)) - (recent.indexOf(b.path) < 0 ? 999 : recent.indexOf(b.path))).map(f => [f.path, recent.includes(f.path) ? 'Recent' : '', () => openNote(f.path)]) : commands;
  paletteItems = items.filter(item => fuzzy(item[0], q)); paletteSelection = 0; drawPalette();
}
function drawPalette() { $('palette-results').innerHTML = paletteItems.map((item, i) => `<button data-command-index="${i}" class="${i === paletteSelection ? 'selected' : ''}">${esc(item[0])}<kbd>${esc(item[1])}</kbd></button>`).join('') || '<p class="empty">No matches</p>'; }
async function executePalette(i) { const item = paletteItems[i]; if (!item) return; $('palette').close(); await item[2](); }

document.addEventListener('click', run(async e => {
  const b = e.target.closest('button, [data-month]'); if (!b) return;
  if (b.dataset.colorName !== undefined) {
    const key = 'org-tag-colors-' + workspace.key;
    let colors; try { colors = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    colors = Object.assign(Object.create(null), colors);
    colors[b.dataset.colorName] = b.dataset.color;
    localStorage.setItem(key, JSON.stringify(colors)); renderTags(); renderAgenda(); renderCalendar(); return;
  }
  if (b.dataset.open) return openNote(b.dataset.open, Number(b.dataset.line) || undefined);
  if (b.dataset.close) return closeTab(b.dataset.close);
  if (b.dataset.folder) { e.preventDefault(); return folderActions(b.dataset.folder); }
  if (b.dataset.view) return setView(workspace.id ? b.dataset.view : 'welcome');
  if (b.dataset.mode) return setMode(b.dataset.mode);
  if (b.dataset.filter) { agendaFilter = b.dataset.filter; renderAgenda(); }
  if (b.dataset.calendar) { calendarMode = b.dataset.calendar; renderCalendar(); }
  if (b.dataset.capture) return capture(b.dataset.capture, b.dataset.time || '');
  if (b.dataset.day) { calendarDate = civil(b.dataset.day); calendarMode = 'day'; renderCalendar(); }
  if (b.dataset.month !== undefined) { calendarDate = new Date(calendarDate.getFullYear(), Number(b.dataset.month), 1, 12); calendarMode = 'month'; renderCalendar(); }
  if (b.dataset.jump) return openNote(active, Number(b.dataset.jump));
  if (b.dataset.tag) { $('search-input').value = ':' + b.dataset.tag + ':'; setView('search'); await search(); }
  if (b.dataset.commandIndex !== undefined) return executePalette(Number(b.dataset.commandIndex));
}));
for (const id of ['open-workspace', 'welcome-open', 'settings-open']) listen(id, 'click', openWorkspace);
listen('new-file', 'click', createFile);
listen('new-folder', 'click', async () => { const path = await askText('New folder', 'Workspace-relative folder path'); if (path) { await call('Mkdir', { id: workspace.id, path }); workspace = await call('Status'); renderTree(); } });
listen('menu', 'click', () => toggleSidebar('left'));
listen('sidebar-close', 'click', () => { toggleSidebar('left'); $('menu').focus(); });
listen('context-toggle', 'click', () => toggleSidebar('right'));
listen('panel-scrim', 'click', () => { closeMobileSidebars(); $('menu').focus(); });
listen('notice', 'click', () => notify(''));
listen('quick-open', 'click', () => openPalette('files')); listen('palette-button', 'click', () => openPalette('commands'));
listen('palette-input', 'input', renderPalette);
listen('palette-input', 'keydown', async e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); paletteSelection = Math.max(0, Math.min(paletteItems.length - 1, paletteSelection + (e.key === 'ArrowDown' ? 1 : -1))); drawPalette(); $('palette-results').querySelector('.selected')?.scrollIntoView({ block: 'nearest' }); } else if (e.key === 'Enter') { e.preventDefault(); await executePalette(paletteSelection); } });
listen('capture', 'click', () => capture()); listen('calendar-capture', 'click', () => capture(dateKey(calendarDate)));
listen('agenda-query', 'input', renderAgenda); listen('kind-filter', 'change', renderAgenda);
listen('calendar-prev', 'click', () => shiftCalendar(-1)); listen('calendar-next', 'click', () => shiftCalendar(1)); listen('calendar-today', 'click', () => { calendarDate = new Date(); renderCalendar(); });
listen('search-input', 'input', () => { searchSequence++; clearTimeout(searchTimer); searchTimer = setTimeout(() => search().catch(fail), 150); });
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() { const choice = $('theme').value; document.documentElement.dataset.theme = choice === 'system' ? systemTheme.matches ? 'dark' : 'light' : choice; setNativeTheme(document.documentElement.dataset.theme === 'dark').catch(fail); }
$('theme').value = localStorage.getItem('org-theme') || 'dark'; applyTheme(); systemTheme.addEventListener('change', applyTheme);
listen('theme', 'change', () => { localStorage.setItem('org-theme', $('theme').value); applyTheme(); });
$('vi-mode').checked = localStorage.getItem('org-vi-mode') === 'true';
listen('vi-mode', 'change', () => { localStorage.setItem('org-vi-mode', String($('vi-mode').checked)); for (const t of tabs.values()) t.vi?.setEnabled($('vi-mode').checked); });
document.addEventListener('keydown', run(async e => {
  if ($('modal').open || $('palette').open) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); const id = layout.focusedGroup().tabs[Number(e.key) - 1]; if (id) layout.select(id); return; }
  if (mod && e.shiftKey && ['l', 'r'].includes(e.key.toLowerCase())) { e.preventDefault(); toggleSidebar(e.key.toLowerCase() === 'l' ? 'left' : 'right'); }
  else if (e.key === 'Escape' && (mobileLeftOpen || mobileRightOpen)) { const trigger = mobileRightOpen ? 'context-toggle' : 'menu'; closeMobileSidebars(); $(trigger).focus(); }
  else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); await save(); }
  else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette('files'); }
  else if (mod && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); openPalette('commands'); }
  else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); await createFile(); }
  else if (source && !e.target.closest('button') && (e.target === source || source.contains(e.target))) {
    const name = e.key === 'Tab' ? e.shiftKey ? 'outdent' : 'indent' : e.altKey ? { Enter: 'heading', ArrowLeft: 'promote', ArrowRight: 'demote', ArrowUp: 'move-up', ArrowDown: 'move-down', t: 'todo' }[e.key] || (e.code === 'KeyT' ? 'todo' : null) : null;
    if (name) { e.preventDefault(); await editorCommand(name); }
  }
}));
window.addEventListener('beforeunload', e => { if ([...tabs.values()].some(dirty)) { e.preventDefault(); e.returnValue = ''; } });
await onClose(run(async () => {
  const results = await Promise.allSettled([...tabs.keys()].map(path => save(path)));
  for (const result of results) if (result.status === 'rejected') fail(result.reason);
  if ([...tabs.values()].some(dirty) && !await confirm('Quit with unsaved edits?', 'Some tabs have unsaved changes. Cancel to save them, or discard them and quit.', 'Discard and quit')) return;
  await quit();
}));
let draggedEntry;
let draggedFile, movingFile = false;
function clearFileDrop() { $('tree').querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target')); }
$('tree').addEventListener('dragstart', e => {
  const el = e.target.closest('[data-move-path]'); if (!el || movingFile) { e.preventDefault(); return; }
  draggedFile = { path: el.dataset.movePath, id: workspace.id };
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', draggedFile.path);
});
$('tree').addEventListener('dragover', e => {
  if (!draggedFile) return;
  const target = e.target.closest('[data-drop-folder]'); clearFileDrop();
  if (target) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; target.classList.add('drop-target'); }
});
$('tree').addEventListener('dragleave', e => { if (!$('tree').contains(e.relatedTarget)) clearFileDrop(); });
$('tree').addEventListener('dragend', () => { draggedFile = null; clearFileDrop(); });
$('tree').addEventListener('drop', run(async e => {
  const target = e.target.closest('[data-drop-folder]'), item = draggedFile;
  draggedFile = null; clearFileDrop();
  if (!item || !target) return;
  e.preventDefault();
  if (movingFile || item.id !== workspace.id) return;
  if (refreshing) { notify('Workspace is updating. Try the move again.'); return; }
  const from = item.path, folder = target.dataset.dropFolder;
  const to = (folder ? folder + '/' : '') + from.split('/').pop();
  if (from === to) return;
  if (folder === from || folder.startsWith(from + '/')) { notify('Choose a folder outside the item being moved.', 'error'); return; }
  const affected = [...tabs].filter(([p]) => p === from || p.startsWith(from + '/'));
  if (affected.some(([, t]) => t.saving)) { notify('Wait for the save to finish before moving this item.'); return; }
  movingFile = true;
  try {
    await call('Rename', { id: item.id, path: from, to });
    openSequence++;
    for (const [p, t] of affected) { const next = to + p.slice(from.length); tabs.delete(p); t.path = next; tabs.set(next, t); if (active === p) active = next; }
    for (let i = 0; i < recent.length; i++) if (recent[i] === from || recent[i].startsWith(from + '/')) recent[i] = to + recent[i].slice(from.length);
    localStorage.setItem('org-recent-' + workspace.key, JSON.stringify(recent.slice(0, 30)));
    workspace = await call('Status'); await refreshData();
    if (view === 'document') showDocument(); renderTabs();
    notify(`Moved to ${to}`);
  } finally { movingFile = false; for (const t of tabs.values()) if (dirty(t) && !t.conflict && !t.saveError) scheduleSave(t); }
}));
$('calendar-grid').addEventListener('dragstart', e => {
  const b = e.target.closest('[data-entry]'); if (!b || b.draggable === false) return;
  draggedEntry = entries[Number(b.dataset.entry)]; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', draggedEntry.title);
});
$('calendar-grid').addEventListener('dragover', e => { if (draggedEntry && e.target.closest('[data-drop-date]')) e.preventDefault(); });
$('calendar-grid').addEventListener('dragend', () => { draggedEntry = null; });
$('calendar-grid').addEventListener('drop', run(async e => {
  const cell = e.target.closest('[data-drop-date]'), item = draggedEntry; draggedEntry = null;
  if (!cell || !item) return; e.preventDefault(); const date = cell.dataset.dropDate;
  if (date === item.stamp.date) return;
  if (dirty(tabs.get(item.path)) || tabs.get(item.path)?.saving) { notify('Save your edits before moving this event.'); return; }
  await call('Reschedule', { id: workspace.id, path: item.path, revision: item.revision, start: item.stamp.start, end: item.stamp.end, value: date });
  await refresh(); notify(`Updated the plaintext timestamp in ${item.path} to ${date}.`);
}));
async function restoreLayout() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('org-layout-' + workspace.key) || 'null'); } catch {}
  if (saved?.tree && workspace.id) {
    const collect = node => node?.children ? node.children.flatMap(collect) : Array.isArray(node?.tabs) ? node.tabs : [];
    for (const id of new Set(collect(saved.tree))) {
      if (typeof id !== 'string') continue;
      if (id.startsWith('view:') && pages.has(id.slice(5))) {
        const name = id.slice(5); layout.open(id, { title: pageNames[name], icon: name === 'welcome' ? 'folder' : name, element: pages.get(name) }, false);
      } else if (id.startsWith('file:')) {
        const path = id.slice(5);
        try { tabs.set(path, tabFrom(await call('Read', { id: workspace.id, path }), { mode: saved.modes?.[path] === 'preview' ? 'preview' : 'edit' })); } catch { /* A previously open file may have been moved or removed. */ }
      }
    }
    renderTabs();
    for (const t of tabs.values()) renderDocument(t);
    layout.restore(saved);
  }
  if (!layout.tabs.size) setView(workspace.id ? 'agenda' : 'welcome');
  restoringLayout = false; layout.changed();
}
try { workspace = await call('Status'); loadRecent(); await refreshData(); await restoreLayout(); renderTabs(); setInterval(() => refresh().catch(fail), 1000); }
catch (err) { fail(err); setView('welcome'); }
