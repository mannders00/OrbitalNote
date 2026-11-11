import { escapeHTML as esc } from './editor.js';
import { patchHTML } from './dom.js';
import { icon } from './icons.js';
import { mountSelectPickers } from './select-picker.js';

const fields = { tag: 'Tag', state: 'Task state', file: 'File', type: 'Entry type', date: 'Date' };
const kinds = { scheduled: 'Scheduled', deadline: 'Deadline', todo: 'Undated TODO', event: 'Event', timestamp: 'Timestamp', completed: 'Completed' };
const operators = field => field === 'date' ? [['is', 'is'], ['before', 'is before'], ['after', 'is after']] : [['is', 'is'], ['not', 'is not']];
export function matchesAgendaQuery(entry, { rules = [], mode = 'all' }) {
  const match = rule => {
    if (rule.field === 'date') {
      const date = entry.stamp.date;
      return !!date && (rule.operator === 'before' ? date < rule.value : rule.operator === 'after' ? date > rule.value : date === rule.value);
    }
    const values = rule.field === 'tag' ? [...(entry.tags || []), ...(entry.fileTags || [])] :
      [rule.field === 'file' ? entry.path : rule.field === 'state' ? entry.state : entry.stamp.kind];
    const found = values.includes(rule.value);
    return rule.operator === 'not' ? !found : found;
  };
  return !rules.length || (mode === 'any' ? rules.some(match) : rules.every(match));
}

export function createAgendaQuery(root, changed, context) {
  let rules = [], entries = [], workspaceKey, views = [], active = '';
  root.innerHTML = `<select data-saved-view aria-label="Saved agenda view"><option value="">Default view</option></select><details class="agenda-query-builder"><summary aria-haspopup="dialog" aria-expanded="false">${icon('sliders')}Filters<span data-rule-count></span></summary></details><div class="query-popup" role="dialog" aria-label="Agenda filters" hidden>
    <div class="query-header"><strong>Filter agenda</strong><button type="button" class="icon-button" data-query-close aria-label="Close filters" title="Close filters">${icon('close')}</button></div>
    <div class="query-body"><label class="query-match">Match <select data-query-mode aria-label="Combine query filters"><option value="all">all filters</option><option value="any">any filter</option></select></label>
    <div class="query-active" hidden><div class="query-active-heading"><span class="query-section-label">Active filters</span><button type="button" data-query-clear>Clear all</button></div><div class="query-chips" aria-label="Active agenda filters"></div></div>
    <div class="query-add"><label>Filter<select data-query-field>${Object.entries(fields).map(([key, name]) => `<option value="${key}">${name}</option>`).join('')}</select></label>
    <label>Condition<select data-query-operator></select></label><label class="query-value-label">Value<span data-query-value-host></span></label><button type="button" class="primary" data-query-add>${icon('plus')}Add filter</button></div></div>
    <div class="query-save"><label>Save this view<input data-view-name maxlength="60" placeholder="e.g. Work deadlines" aria-label="Agenda view name"></label><button type="button" data-save-view>Save view</button><button type="button" data-delete-view hidden>Delete saved view</button></div>
    <p data-query-message role="status"></p></div>`;
  const find = selector => root.querySelector(selector), field = find('[data-query-field]'), operator = find('[data-query-operator]');
  const focusField = () => (field.nextElementSibling?.querySelector('input') || field).focus();
  const details = find('details'), summary = find('summary'), popup = find('.query-popup');
  const savedSelect = find('[data-saved-view]');
  const quickSelect = savedSelect.cloneNode(true);
  quickSelect.removeAttribute('data-saved-view'); quickSelect.setAttribute('data-quick-view', '');
  quickSelect.setAttribute('aria-label', 'Current filter view');
  savedSelect.before(quickSelect);
  const viewSection = document.createElement('div'); viewSection.className = 'query-view-section';
  const viewLabel = document.createElement('label'); viewLabel.textContent = 'View';
  viewLabel.append(savedSelect); viewSection.append(viewLabel);
  popup.querySelector('.query-header').after(viewSection);
  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'icon-button planner-clear-filter'; reset.hidden = true;
  reset.innerHTML = icon('close'); reset.title = 'Clear active filters'; reset.setAttribute('aria-label', 'Clear active filters');
  viewSection.append(reset);
  // Keep the top-layer panel outside details' hidden content slot: WebKit can
  // retain stale hidden descendants there after closing and reopening it.
  popup.id = `${root.id}-popup`; summary.setAttribute('aria-controls', popup.id);
  const topLayer = typeof popup.showPopover === 'function';
  if (topLayer) popup.setAttribute('popover', 'manual');
  function choices() {
    const previous = find('[data-query-value]')?.value;
    const data = field.value === 'tag' ? entries.flatMap(e => [...(e.tags || []), ...(e.fileTags || [])]) :
      field.value === 'file' ? entries.map(e => e.path) : field.value === 'state' ? entries.map(e => e.state) : entries.map(e => e.stamp.kind);
    const values = [...new Set(data.filter(Boolean))].sort();
    if (field.value === 'date') patchHTML(find('[data-query-value-host]'), '<input data-query-value type="date" aria-label="Filter value">');
    else {
      if (!find('select[data-query-value]')) patchHTML(find('[data-query-value-host]'), '<select data-query-value aria-label="Filter value"></select>');
      patchHTML(find('select[data-query-value]'), values.length ? values.map(value => `<option value="${esc(value)}">${esc(field.value === 'type' ? kinds[value] || value : value)}</option>`).join('') : '<option value="">No values in this workspace</option>');
    }
    if (previous && (field.value === 'date' || values.includes(previous))) find('[data-query-value]').value = previous;
  }
  function configure() {
    operator.innerHTML = operators(field.value).map(([value, label]) => `<option value="${value}">${label}</option>`).join(''); choices();
  }
  function render() {
    find('[data-rule-count]').textContent = rules.length || '';
    summary.dataset.active = String(!!rules.length);
    summary.setAttribute('aria-label', rules.length ? `Filters, ${rules.length} active` : 'Filters');
    patchHTML(find('.query-chips'), rules.map((rule, i) => {
      const label = `${fields[rule.field]} ${operators(rule.field).find(([op]) => op === rule.operator)[1]} ${rule.field === 'type' ? kinds[rule.value] || rule.value : rule.value}`;
      return `<button type="button" data-remove-rule="${i}" aria-label="Remove filter: ${esc(label)}"><span>${esc(label)}</span>${icon('close')}</button>`;
    }).join(''));
    find('.query-active').hidden = !rules.length;
    find('[data-query-clear]').hidden = !rules.length;
    patchHTML(find('[data-saved-view]'), '<option value="">Default view</option>' + views.map(view => `<option value="${esc(view.name)}">${esc(view.name)}${active === view.name && JSON.stringify(view.query) !== JSON.stringify(snapshot()) ? ' · edited' : ''}</option>`).join(''));
    find('[data-saved-view]').value = active;
    find('[data-saved-view]').title = active || 'Default view';
    patchHTML(quickSelect, savedSelect.innerHTML); quickSelect.value = active;
    for (const select of [savedSelect, quickSelect, find('[data-query-mode]')]) select.dispatchEvent(new Event('picker-sync'));
    find('[data-delete-view]').hidden = !active;
    const query = context.read();
    reset.hidden = !active && !rules.length && !query.text && !query.kind;
    const shortcut = quickSelect.nextElementSibling;
    if (shortcut?.classList.contains('task-file-picker')) shortcut.hidden = !active && !rules.length && !query.kind;
    const signature = JSON.stringify(views);
    if (root.viewsSignature !== signature) { root.viewsSignature = signature; root.dispatchEvent(new CustomEvent('saved-views-changed', { detail: views })); }
  }
  const snapshot = () => ({ rules: rules.map(r => ({ ...r })), mode: find('[data-query-mode]').value, ...context.read() });
  const storagePrefix = 'orbitalnote-agenda-views-';
  const draft = () => ({ rules: rules.map(rule => ({ ...rule })), mode: find('[data-query-mode]').value });
  function persist(applyContext = false) {
    const state = { views, active, draft: draft(), calendarMigrated: true };
    localStorage.setItem(storagePrefix + workspaceKey, JSON.stringify(state));
    document.dispatchEvent(new CustomEvent('planner-query-change', { detail: { root, key: workspaceKey, state: structuredClone(state), applyContext } }));
  }
  document.addEventListener('planner-query-change', ({ detail }) => {
    if (detail.root === root || detail.key !== workspaceKey) return;
    views = detail.state.views; active = detail.state.active;
    if (detail.applyContext) restore(views.find(view => view.name === active));
    rules = detail.state.draft.rules;
    find('[data-query-mode]').value = detail.state.draft.mode;
    find('[data-view-name]').value = active;
    render(); changed();
  });
  function restore(view) {
    rules = view?.query.rules.map(r => ({ ...r })) || [];
    find('[data-query-mode]').value = view?.query.mode || 'all';
    context.apply(view?.query || { range: 'all', text: '', kind: '' });
    find('[data-view-name]').value = view?.name || '';
  }
  reset.addEventListener('click', () => {
    active = ''; restore(null); persist(true); render(); changed();
    summary.focus({ preventScroll: true });
  });
  find('[data-saved-view]').addEventListener('change', e => {
    active = e.target.value; restore(views.find(v => v.name === active)); persist(true); render(); changed();
  });
  quickSelect.addEventListener('change', () => {
    savedSelect.value = quickSelect.value;
    savedSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  find('[data-save-view]').addEventListener('click', () => {
    const name = find('[data-view-name]').value.trim();
    if (!name) { find('[data-query-message]').textContent = 'Give this view a name.'; find('[data-view-name]').focus(); return; }
    const saved = { name, query: snapshot() }, index = views.findIndex(v => v.name === name);
    if (index < 0) views.push(saved); else views[index] = saved;
    active = name; persist(); render(); find('[data-query-message]').textContent = 'View saved for this workspace on this device.';
  });
  find('[data-delete-view]').addEventListener('click', () => {
    views = views.filter(v => v.name !== active); active = ''; persist(); render();
    find('[data-view-name]').value = ''; find('[data-query-message]').textContent = 'Saved view deleted. Current filters retained.';
    find('[data-view-name]').focus();
  });
  function close(restoreFocus = false) {
    details.open = false; summary.setAttribute('aria-expanded', 'false');
    if (topLayer && popup.matches(':popover-open')) popup.hidePopover();
    popup.hidden = true;
    if (restoreFocus) summary.focus({ preventScroll: true });
  }
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape' && details.open) { e.preventDefault(); close(true); e.stopPropagation(); }
    if (e.key === 'Enter' && e.target.matches('[data-view-name]')) { e.preventDefault(); find('[data-save-view]').click(); }
  });
  find('[data-query-close]').addEventListener('click', () => close(true));
  const contains = target => details.contains(target) || popup.contains(target);
  document.addEventListener('pointerdown', e => { if (!contains(e.target)) close(); });
  root.addEventListener('focusout', e => { if (e.relatedTarget && !contains(e.relatedTarget)) close(); });
  function positionPopup() {
    if (!details.open) return;
    const rect = summary.getBoundingClientRect(), viewport = window.visualViewport;
    if (!rect.width || !rect.height) { close(); return; }
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || document.documentElement.clientWidth, height = viewport?.height || document.documentElement.clientHeight;
    const margin = 12, gap = 8;
    popup.style.width = `${Math.min(380, Math.max(0, width - margin * 2))}px`;
    popup.style.maxHeight = `${Math.max(0, height - margin * 2)}px`;
    const below = top + height - margin - rect.bottom - gap, above = rect.top - top - margin - gap;
    const y = below < popup.offsetHeight && above >= popup.offsetHeight ? rect.top - gap - popup.offsetHeight : rect.bottom + gap;
    popup.style.left = `${Math.max(left + margin, Math.min(left + width - popup.offsetWidth - margin, rect.right - popup.offsetWidth))}px`;
    popup.style.top = `${Math.max(top + margin, Math.min(top + height - popup.offsetHeight - margin, y))}px`;
  }
  details.addEventListener('toggle', () => {
    summary.setAttribute('aria-expanded', String(details.open));
    if (details.open) {
      popup.hidden = false;
      // Top-layer positioning keeps the panel usable in clipped split panes.
      if (topLayer && !popup.matches(':popover-open')) popup.showPopover();
      positionPopup();
    } else close();
  });
  window.addEventListener('resize', positionPopup);
  window.visualViewport?.addEventListener('resize', positionPopup);
  window.visualViewport?.addEventListener('scroll', positionPopup);
  document.addEventListener('scroll', e => { if (!popup.contains(e.target)) positionPopup(); }, true);
  const observer = new ResizeObserver(positionPopup); observer.observe(popup); observer.observe(summary);
  field.addEventListener('change', configure);
  find('[data-query-mode]').addEventListener('change', () => { persist(); render(); changed(); });
  find('[data-query-add]').addEventListener('click', () => {
    const value = find('[data-query-value]').value;
    if (!value) { find('[data-query-message]').textContent = 'Choose a filter value first.'; return; }
    const rule = { field: field.value, operator: operator.value, value };
    if (!rules.some(r => JSON.stringify(r) === JSON.stringify(rule))) rules.push(rule);
    find('[data-query-message]').textContent = 'Filter added.'; persist(); render(); changed();
    close(true);
  });
  find('.query-chips').addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button) return;
    rules.splice(Number(button.dataset.removeRule), 1);
    persist(); render(); changed();
    const next = find(`[data-remove-rule="${Math.min(Number(button.dataset.removeRule), rules.length - 1)}"]`);
    if (next) next.focus(); else focusField();
  });
  find('[data-query-clear]').addEventListener('click', () => {
    rules = []; persist(); render(); changed(); focusField();
  });
  configure(); render(); mountSelectPickers(root); render();
  return {
    savedViews: () => views,
    matches: entry => matchesAgendaQuery(entry, { rules, mode: find('[data-query-mode]').value }),
    update: (next, key) => {
      entries = next;
      if (workspaceKey !== key) {
        workspaceKey = key; rules = []; views = []; active = '';
        try {
          const saved = JSON.parse(localStorage.getItem(storagePrefix + key) || '{}');
          if (!saved.calendarMigrated) {
            const legacy = JSON.parse(localStorage.getItem('orbitalnote-calendar-views-' + key) || '{}');
            saved.views = Array.isArray(saved.views) ? saved.views : [];
            for (const view of Array.isArray(legacy.views) ? legacy.views : []) {
              if (saved.views.some(v => v.name === view.name && JSON.stringify(v.query) === JSON.stringify(view.query))) continue;
              let name = view.name;
              while (saved.views.some(v => v.name === name)) name += ' (Calendar)';
              saved.views.push({ ...view, name });
            }
            saved.calendarMigrated = true;
            localStorage.setItem(storagePrefix + key, JSON.stringify(saved));
          }
          views = (Array.isArray(saved.views) ? saved.views : []).filter(v => typeof v.name === 'string' && v.query && ['all','any'].includes(v.query.mode) && ['today','upcoming','overdue','all'].includes(v.query.range) && typeof v.query.text === 'string' && typeof v.query.kind === 'string' && Array.isArray(v.query.rules) && v.query.rules.every(r => r && fields[r.field] && operators(r.field).some(([op]) => op === r.operator) && typeof r.value === 'string'));
          active = views.some(v => v.name === saved.active) ? saved.active : '';
          if (active) restore(views.find(v => v.name === active));
          else { find('[data-query-mode]').value = 'all'; find('[data-view-name]').value = ''; context.apply({ range: context.defaultRange || 'today', text: '', kind: '' }); }
          if (saved.draft && ['all', 'any'].includes(saved.draft.mode) && Array.isArray(saved.draft.rules) && saved.draft.rules.every(r => r && fields[r.field] && operators(r.field).some(([op]) => op === r.operator) && typeof r.value === 'string')) {
            rules = saved.draft.rules.map(r => ({ ...r })); find('[data-query-mode]').value = saved.draft.mode;
          }
        } catch {}
      }
      choices(); render();
    },
  };
}
