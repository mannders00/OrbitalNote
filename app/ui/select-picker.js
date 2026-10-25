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
  list.setAttribute('aria-label', label);
  wrapper.append(toggle);
  // A popover enters the browser's top layer, escaping modal scroll clipping
  // while remaining a descendant of the dialog (and therefore not inert).
  const root = input.closest('dialog') || document.body;
  const topLayer = typeof list.showPopover === 'function';
  if (topLayer) list.setAttribute('popover', 'manual');
  root.append(list);
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', list.id); input.setAttribute('aria-expanded', 'false'); input.autocomplete = 'off';
  let matches = [], selected = -1;
  const close = () => {
    if (topLayer && list.matches(':popover-open')) list.hidePopover();
    list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); restore?.();
  };
  function position() {
    if (list.hidden) return;
    const anchor = input.getBoundingClientRect(), viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || document.documentElement.clientWidth;
    const height = viewport?.height || document.documentElement.clientHeight;
    const gap = 4, margin = 12;
    const below = Math.max(0, top + height - anchor.bottom - gap - margin);
    const above = Math.max(0, anchor.top - top - gap - margin);
    const down = below >= Math.min(240, list.scrollHeight) || below >= above;
    const available = Math.min(480, down ? below : above);
    const listWidth = Math.min(Math.max(anchor.width, 320), Math.max(0, width - margin * 2));
    Object.assign(list.style, { width: `${listWidth}px`, maxHeight: `${available}px`,
      left: `${Math.max(left + margin, Math.min(anchor.left, left + width - margin - listWidth))}px`,
      top: `${down ? anchor.bottom + gap : Math.max(top + margin, anchor.top - gap - Math.min(list.scrollHeight + 2, available))}px` });
  }
  const highlight = () => {
    [...list.children].forEach((el, i) => el.setAttribute('aria-selected', String(i === selected)));
    const row = selected >= 0 ? list.children[selected] : null;
    if (row) {
      input.setAttribute('aria-activedescendant', row.id);
      // Reveal only inside the list; scrollIntoView also moves the modal/page.
      const option = row.getBoundingClientRect(), bounds = list.getBoundingClientRect();
      const top = bounds.top + list.clientTop, bottom = top + list.clientHeight;
      if (option.top < top) list.scrollTop -= top - option.top;
      else if (option.bottom > bottom) list.scrollTop += option.bottom - bottom;
    }
    else input.removeAttribute('aria-activedescendant');
  };
  function draw(all = false) {
    matches = options().filter(o => o.label.toLowerCase().includes(all ? '' : input.value.toLowerCase())); selected = -1;
    list.replaceChildren();
    for (const [i, option] of matches.entries()) {
      const row = document.createElement('div'); row.role = 'option'; row.id = `${list.id}-${i}`; row.title = option.label;
      const text = document.createElement('span'); text.textContent = option.label; row.append(text);
      if (option.detail) { const detail = document.createElement('small'); detail.textContent = option.detail; row.append(detail); }
      row.addEventListener('pointerdown', e => { e.preventDefault(); select(i); }); list.append(row);
    }
    if (!matches.length) { const text = document.createElement('p'); text.textContent = empty; list.append(text); }
    list.hidden = false;
    if (topLayer && !list.matches(':popover-open')) list.showPopover();
    position(); input.setAttribute('aria-expanded', 'true'); highlight();
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
  wrapper.addEventListener('focusout', e => { if (!wrapper.contains(e.relatedTarget) && !list.contains(e.relatedTarget)) close(); });
  const outside = e => { if (!wrapper.contains(e.target) && !list.contains(e.target)) close(); };
  const scroll = e => { if (!list.contains(e.target)) position(); };
  document.addEventListener('pointerdown', outside);
  window.addEventListener('resize', position);
  document.addEventListener('scroll', scroll, true);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  return { wrapper, refresh() { toggle.disabled = input.disabled; if (input.disabled) close(); else if (!list.hidden) draw(true); }, dispose() {
    close(); list.remove(); document.removeEventListener('pointerdown', outside);
    window.removeEventListener('resize', position); document.removeEventListener('scroll', scroll, true);
    window.visualViewport?.removeEventListener('resize', position); window.visualViewport?.removeEventListener('scroll', position);
  } };
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
