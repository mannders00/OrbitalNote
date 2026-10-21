import { icon } from './icons.js';

let serial = 0;
// Keep the select as the form value; the shared picker owns its presentation.
export function mountSelectPickers(root) {
  const cleanups = [];
  function mount(select) {
    if (select.dataset.picker) return;
    select.dataset.picker = 'true'; select.hidden = true;
    const wrapper = document.createElement('div'); wrapper.className = 'select-picker';
    select.after(wrapper);
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'select-picker-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
    const label = select.closest('label')?.firstChild?.textContent.trim() || select.getAttribute('aria-label') || 'Choose';
    trigger.setAttribute('aria-label', label);
    const popup = document.createElement('div'); popup.className = 'select-picker-popup'; popup.hidden = true;
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search…'; search.autocomplete = 'off'; search.setAttribute('aria-label', `Search ${label}`);
    const list = document.createElement('div'); list.className = 'select-picker-options'; list.id = `select-picker-${++serial}`; list.role = 'listbox'; list.setAttribute('aria-label', label);
    search.setAttribute('role', 'combobox'); search.setAttribute('aria-controls', list.id); search.setAttribute('aria-expanded', 'false'); search.setAttribute('aria-autocomplete', 'list');
    trigger.setAttribute('aria-controls', list.id);
    popup.append(search, list); wrapper.append(trigger, popup);
    let matches = [], active = 0;
    const close = (focus = false) => { popup.hidden = true; trigger.setAttribute('aria-expanded', 'false'); search.setAttribute('aria-expanded', 'false'); if (focus) trigger.focus(); };
    function highlight() {
      [...list.children].forEach((el, i) => el.classList.toggle('highlighted', i === active));
      const option = matches.length ? list.children[active] : null;
      if (option) { search.setAttribute('aria-activedescendant', option.id); option.scrollIntoView({ block: 'nearest' }); }
      else search.removeAttribute('aria-activedescendant');
    }
    function draw() {
      matches = [...select.options].filter(o => !o.disabled && o.textContent.toLowerCase().includes(search.value.toLowerCase()));
      list.replaceChildren(); active = 0;
      for (const [i, option] of matches.entries()) {
        const row = document.createElement('div'); row.role = 'option'; row.id = `${list.id}-${i}`; row.textContent = option.textContent; row.setAttribute('aria-selected', String(option.selected));
        row.addEventListener('mousedown', e => e.preventDefault()); row.addEventListener('click', () => choose(i)); list.append(row);
      }
      if (!matches.length) { const empty = document.createElement('p'); empty.textContent = 'No matches'; list.append(empty); }
      highlight();
    }
    function choose(i) { if (!matches[i]) return; select.value = matches[i].value; select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); sync(); close(true); }
    function sync() { trigger.replaceChildren(document.createTextNode(select.selectedOptions[0]?.textContent || 'Choose…')); const arrow = document.createElement('span'); arrow.innerHTML = icon('down'); trigger.append(arrow); trigger.disabled = select.disabled; if (!popup.hidden) draw(); }
    function open() { popup.hidden = false; trigger.setAttribute('aria-expanded', 'true'); search.setAttribute('aria-expanded', 'true'); search.value = ''; draw(); search.focus(); }
    trigger.addEventListener('click', () => popup.hidden ? open() : close());
    trigger.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
    search.addEventListener('input', draw);
    wrapper.addEventListener('keydown', e => {
      if (popup.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      if (e.key === 'Tab') close();
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(e.key) && e.target === search) {
        e.preventDefault(); e.stopPropagation();
        if (e.key === 'Enter') choose(active);
        else { active = e.key === 'Home' ? 0 : e.key === 'End' ? matches.length - 1 : Math.max(0, Math.min(matches.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1))); highlight(); }
      }
    });
    const outside = e => { if (!wrapper.contains(e.target)) close(); };
    root.addEventListener('pointerdown', outside);
    select.addEventListener('change', sync);
    const observer = new MutationObserver(sync); observer.observe(select, { childList: true, subtree: true, attributes: true });
    sync(); cleanups.push(() => { observer.disconnect(); root.removeEventListener('pointerdown', outside); select.removeEventListener('change', sync); });
  }
  const scan = () => root.querySelectorAll('select:not([data-picker])').forEach(mount);
  scan(); const observer = new MutationObserver(scan); observer.observe(root, { childList: true, subtree: true });
  return () => { observer.disconnect(); cleanups.forEach(cleanup => cleanup()); };
}
