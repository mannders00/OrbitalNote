import { escapeHTML as esc } from './editor.js';
import { patchHTML } from './dom.js';

const fields = { tag: 'Tag', state: 'Task state', file: 'File', type: 'Entry type', date: 'Date' };
const kinds = { scheduled: 'Scheduled', deadline: 'Deadline', todo: 'Undated TODO', timestamp: 'Timestamp' };
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
  root.innerHTML = `<select data-saved-view aria-label="Saved agenda view"><option value="">Custom view</option></select><details class="agenda-query-builder"><summary>+ Filter <span data-rule-count></span></summary><div class="query-popup"><div class="query-chips" aria-label="Active agenda filters"></div>
    <strong>Filter this agenda</strong>
    <label class="query-match">Match <select data-query-mode aria-label="Combine query filters"><option value="all">all filters</option><option value="any">any filter</option></select></label>
    <div class="query-add"><label>Filter<select data-query-field>${Object.entries(fields).map(([key, name]) => `<option value="${key}">${name}</option>`).join('')}</select></label>
    <label>Condition<select data-query-operator></select></label><label class="query-value-label">Value<span data-query-value-host></span></label><button type="button" data-query-add>Add filter</button></div>
    <div class="query-save"><label>Save as a view<input data-view-name maxlength="60" placeholder="e.g. Work deadlines" aria-label="Agenda view name"></label><button type="button" data-save-view>Save view</button><button type="button" data-delete-view hidden>Delete view</button></div>
    <p data-query-message role="status"></p></div></details>`;
  const find = selector => root.querySelector(selector), field = find('[data-query-field]'), operator = find('[data-query-operator]');
  function choices() {
    const previous = find('[data-query-value]')?.value;
    const data = field.value === 'tag' ? entries.flatMap(e => [...(e.tags || []), ...(e.fileTags || [])]) :
      field.value === 'file' ? entries.map(e => e.path) : field.value === 'state' ? entries.map(e => e.state) : entries.map(e => e.stamp.kind);
    const values = [...new Set(data.filter(Boolean))].sort();
    if (field.value === 'date') patchHTML(find('[data-query-value-host]'), '<input data-query-value type="date" aria-label="Filter value">');
    else patchHTML(find('[data-query-value-host]'), `<select data-query-value aria-label="Filter value">${values.length ? values.map(value => `<option value="${esc(value)}">${esc(field.value === 'type' ? kinds[value] || value : value)}</option>`).join('') : '<option value="">No values in this workspace</option>'}</select>`);
    if (previous && (field.value === 'date' || values.includes(previous))) find('[data-query-value]').value = previous;
  }
  function configure() {
    operator.innerHTML = operators(field.value).map(([value, label]) => `<option value="${value}">${label}</option>`).join(''); choices();
  }
  function render() {
    find('[data-rule-count]').textContent = rules.length ? `(${rules.length})` : '';
    patchHTML(find('.query-chips'), rules.map((rule, i) => {
      const label = `${fields[rule.field]} ${operators(rule.field).find(([op]) => op === rule.operator)[1]} ${rule.field === 'type' ? kinds[rule.value] || rule.value : rule.value}`;
      return `<button type="button" data-remove-rule="${i}" aria-label="Remove filter: ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`;
    }).join('') + (rules.length ? '<button type="button" data-query-clear>Clear filters</button>' : ''));
    patchHTML(find('[data-saved-view]'), '<option value="">Custom view</option>' + views.map(view => `<option value="${esc(view.name)}">${esc(view.name)}${active === view.name && JSON.stringify(view.query) !== JSON.stringify(snapshot()) ? ' · edited' : ''}</option>`).join(''));
    find('[data-saved-view]').value = active;
    find('[data-delete-view]').hidden = !active;
    const signature = JSON.stringify(views);
    if (root.viewsSignature !== signature) { root.viewsSignature = signature; root.dispatchEvent(new CustomEvent('saved-views-changed', { detail: views })); }
  }
  const snapshot = () => ({ rules: rules.map(r => ({ ...r })), mode: find('[data-query-mode]').value, ...context.read() });
  const persist = () => localStorage.setItem('orbitalnote-agenda-views-' + workspaceKey, JSON.stringify({ views, active }));
  function restore(view) {
    rules = view?.query.rules.map(r => ({ ...r })) || [];
    find('[data-query-mode]').value = view?.query.mode || 'all';
    context.apply(view?.query || { range: 'all', text: '', kind: '' });
    find('[data-view-name]').value = view?.name || '';
  }
  find('[data-saved-view]').addEventListener('change', e => {
    active = e.target.value; restore(views.find(v => v.name === active)); persist(); render(); changed();
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
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { find('details').open = false; find('summary').focus(); e.stopPropagation(); }
    if (e.key === 'Enter' && e.target.matches('[data-view-name]')) { e.preventDefault(); find('[data-save-view]').click(); }
  });
  document.addEventListener('pointerdown', e => { if (!root.contains(e.target)) find('details').open = false; });
  function positionPopup() {
    if (!find('details').open) return;
    const rect = find('summary').getBoundingClientRect(), popup = find('.query-popup');
    popup.style.left = `${Math.max(8, Math.min(innerWidth - popup.offsetWidth - 8, rect.right - popup.offsetWidth))}px`;
    popup.style.top = `${Math.max(8, Math.min(innerHeight - popup.offsetHeight - 8, rect.bottom + 7))}px`;
  }
  find('details').addEventListener('toggle', positionPopup);
  window.addEventListener('resize', positionPopup);
  new ResizeObserver(positionPopup).observe(find('.query-popup'));
  field.addEventListener('change', configure);
  find('[data-query-mode]').addEventListener('change', () => { render(); changed(); });
  find('[data-query-add]').addEventListener('click', () => {
    const value = find('[data-query-value]').value;
    if (!value) { find('[data-query-message]').textContent = 'Choose a filter value first.'; return; }
    const rule = { field: field.value, operator: operator.value, value };
    if (!rules.some(r => JSON.stringify(r) === JSON.stringify(rule))) rules.push(rule);
    find('[data-query-message]').textContent = 'Filter added.'; render(); changed();
    find('details').open = false; find('summary').focus();
  });
  find('.query-chips').addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-query-clear')) rules = [];
    else rules.splice(Number(button.dataset.removeRule), 1);
    render(); changed();
    (find('.query-chips button') || find('summary')).focus();
  });
  configure(); render();
  return {
    savedViews: () => views,
    matches: entry => matchesAgendaQuery(entry, { rules, mode: find('[data-query-mode]').value }),
    update: (next, key) => {
      entries = next;
      if (workspaceKey !== key) {
        workspaceKey = key; rules = []; views = []; active = '';
        try {
          const saved = JSON.parse(localStorage.getItem('orbitalnote-agenda-views-' + key) || '{}');
          views = (Array.isArray(saved.views) ? saved.views : []).filter(v => typeof v.name === 'string' && v.query && ['all','any'].includes(v.query.mode) && ['today','upcoming','overdue','all'].includes(v.query.range) && typeof v.query.text === 'string' && typeof v.query.kind === 'string' && Array.isArray(v.query.rules) && v.query.rules.every(r => r && fields[r.field] && operators(r.field).some(([op]) => op === r.operator) && typeof r.value === 'string'));
          active = views.some(v => v.name === saved.active) ? saved.active : '';
        } catch {}
        if (active) restore(views.find(v => v.name === active));
        else { find('[data-query-mode]').value = 'all'; find('[data-view-name]').value = ''; context.apply({ range: 'today', text: '', kind: '' }); }
      }
      choices(); render();
    },
  };
}
