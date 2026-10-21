import { icon } from './icons.js';

let serial = 0;

// Shared editable combobox. Callers decide whether typed text is a free-form
// value (task files) or a search over a fixed selection (folders/headings).
export function mountPicker(input, { options, choose, label, restore, empty = 'No matches' }) {
  const wrapper = document.createElement('div'); wrapper.className = 'task-file-picker';
  input.replaceWith(wrapper); wrapper.append(input);
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'icon-button';
  toggle.innerHTML = icon('down'); toggle.setAttribute('aria-label', `Choose ${label}`);
  const list = document.createElement('div'); list.className = 'task-file-options'; list.id = `picker-${++serial}`; list.role = 'listbox'; list.hidden = true;
  wrapper.append(toggle, list);
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', list.id); input.setAttribute('aria-expanded', 'false'); input.autocomplete = 'off';
  let matches = [], selected = -1;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); restore?.(); };
  const highlight = () => {
    [...list.children].forEach((el, i) => el.setAttribute('aria-selected', String(i === selected)));
    const row = selected >= 0 ? list.children[selected] : null;
    if (row) { input.setAttribute('aria-activedescendant', row.id); row.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  };
  function draw(all = false) {
    matches = options().filter(o => o.label.toLowerCase().includes(all ? '' : input.value.toLowerCase())); selected = -1;
    list.replaceChildren();
    for (const [i, option] of matches.entries()) {
      const row = document.createElement('div'); row.role = 'option'; row.id = `${list.id}-${i}`;
      const text = document.createElement('span'); text.textContent = option.label; row.append(text);
      if (option.detail) { const detail = document.createElement('small'); detail.textContent = option.detail; row.append(detail); }
      row.addEventListener('pointerdown', e => { e.preventDefault(); select(i); }); list.append(row);
    }
    if (!matches.length) { const text = document.createElement('p'); text.textContent = empty; list.append(text); }
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); highlight();
  }
  function select(index) { if (!matches[index]) return; choose(matches[index]); input.focus(); close(); }
  input.addEventListener('input', () => draw());
  input.addEventListener('focus', () => draw(true));
  toggle.addEventListener('pointerdown', e => e.preventDefault());
  toggle.addEventListener('click', () => { if (list.hidden) { input.focus(); draw(true); } else close(); });
  input.addEventListener('keydown', e => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation(); if (list.hidden) draw(true);
      selected = Math.max(0, Math.min(matches.length - 1, selected + (e.key === 'ArrowDown' ? 1 : -1))); highlight();
    } else if (e.key === 'Enter' && !list.hidden && (selected >= 0 || matches.length === 1)) {
      e.preventDefault(); e.stopPropagation(); select(selected >= 0 ? selected : 0);
    } else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close();
  });
  wrapper.addEventListener('focusout', e => { if (!wrapper.contains(e.relatedTarget)) close(); });
  const outside = e => { if (!wrapper.contains(e.target)) close(); };
  const root = input.closest('dialog') || document;
  root.addEventListener('pointerdown', outside);
  return { wrapper, refresh() { toggle.disabled = input.disabled; if (input.disabled) close(); else if (!list.hidden) draw(true); }, dispose() { root.removeEventListener('pointerdown', outside); } };
}

export function mountSelectPickers(root) {
  const cleanups = [];
  function mount(select) {
    if (select.dataset.picker) return;
    select.dataset.picker = 'true'; select.hidden = true;
    const label = select.closest('label')?.firstChild?.textContent.trim() || select.getAttribute('aria-label') || 'value';
    const input = document.createElement('input'); input.type = 'text'; input.setAttribute('aria-label', label); select.after(input);
    const restore = () => { input.value = select.selectedOptions[0]?.textContent || ''; };
    const picker = mountPicker(input, {
      label, restore,
      options: () => [...select.options].filter(o => !o.disabled).map(o => ({ value: o.value, label: o.textContent })),
      choose: option => { select.value = option.value; select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); },
    });
    const sync = () => { restore(); input.disabled = select.disabled; picker.refresh(); };
    select.addEventListener('change', sync);
    const observer = new MutationObserver(sync); observer.observe(select, { childList: true, subtree: true, attributes: true });
    sync(); cleanups.push(() => { observer.disconnect(); picker.dispose(); select.removeEventListener('change', sync); });
  }
  const scan = () => root.querySelectorAll('select:not([data-picker])').forEach(mount);
  scan(); const observer = new MutationObserver(scan); observer.observe(root, { childList: true, subtree: true });
  return () => { observer.disconnect(); cleanups.forEach(cleanup => cleanup()); };
}
