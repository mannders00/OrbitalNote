import { escapeHTML as esc } from './editor.js';
import { icon } from './icons.js';

// The caller supplies a snapshot ordered by open/recent use, not a live file list.
export function mountTaskDestination(root, files, readNote) {
  const input = root.querySelector('[name="path"]');
  if (!input || input.type === 'hidden') return () => {};
  const wrapper = document.createElement('div'); wrapper.className = 'task-file-picker';
  input.replaceWith(wrapper); wrapper.append(input);
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'icon-button';
  toggle.innerHTML = icon('down'); toggle.setAttribute('aria-label', 'Choose Org file'); wrapper.append(toggle);
  const list = document.createElement('div'); list.className = 'task-file-options'; list.id = 'task-file-options'; list.role = 'listbox'; list.hidden = true; wrapper.append(list);
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', list.id); input.setAttribute('aria-expanded', 'false'); input.autocomplete = 'off';
  const parentLabel = document.createElement('label'); parentLabel.textContent = 'Parent heading';
  const parent = document.createElement('select'); parent.name = 'parentLine'; parentLabel.append(parent); wrapper.closest('label').after(parentLabel);
  const revision = document.createElement('input'); revision.type = 'hidden'; revision.name = 'parentRevision'; parentLabel.append(revision);
  let matches = [], selected = -1, sequence = 0, disposed = false;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
  const highlight = () => {
    [...list.children].forEach((el, i) => el.setAttribute('aria-selected', String(i === selected)));
    if (selected >= 0) { input.setAttribute('aria-activedescendant', `task-file-${selected}`); list.children[selected]?.scrollIntoView({ block: 'nearest' }); }
  };
  const draw = (all = false) => {
    const query = all ? '' : input.value.toLowerCase();
    matches = files.filter(f => f.path.toLowerCase().includes(query)).slice(0, 50); selected = -1;
    list.innerHTML = matches.map((f, i) => `<div role="option" id="task-file-${i}" data-index="${i}" aria-selected="false"><span>${esc(f.path)}</span><small>${esc(f.label || '')}</small></div>`).join('') || '<p>No matching files. Enter a new .org path to create one.</p>';
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); input.removeAttribute('aria-activedescendant');
  };
  async function load() {
    const seq = ++sequence, path = input.value.trim();
    parent.disabled = true; parent.innerHTML = '<option value="">Top level (end of file)</option>'; revision.value = '';
    input.setCustomValidity('');
    if (!files.some(f => f.path === path)) { parent.disabled = false; return; }
    input.setCustomValidity('Wait for the heading list to load.');
    try {
      const note = await readNote(path);
      if (disposed || seq !== sequence) return;
      parent.innerHTML += note.headings.map(h => `<option value="${h.line}">${esc('　'.repeat(Math.min(h.level - 1, 8)) + h.title)}</option>`).join('');
      revision.value = note.revision; input.setCustomValidity(''); parent.disabled = false;
    } catch {
      if (!disposed && seq === sequence) input.setCustomValidity('Unable to load this file. Choose it again to retry.');
    }
  }
  const choose = index => { if (!matches[index]) return; input.value = matches[index].path; close(); load(); input.focus(); };
  input.addEventListener('input', () => { draw(); load(); });
  input.addEventListener('focus', () => draw(true));
  toggle.addEventListener('click', () => list.hidden ? draw(true) : close());
  list.addEventListener('pointerdown', e => { const option = e.target.closest('[data-index]'); if (option) { e.preventDefault(); choose(Number(option.dataset.index)); } });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.hidden) draw(true); selected = Math.max(0, Math.min(matches.length - 1, selected + (e.key === 'ArrowDown' ? 1 : -1))); highlight(); }
    else if (e.key === 'Enter' && !list.hidden && (selected >= 0 || matches.length === 1)) { e.preventDefault(); e.stopPropagation(); choose(selected >= 0 ? selected : 0); }
    else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
  });
  const outside = e => { if (!wrapper.contains(e.target)) close(); };
  root.addEventListener('pointerdown', outside); load();
  return () => { disposed = true; sequence++; root.removeEventListener('pointerdown', outside); };
}
