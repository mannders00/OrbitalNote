import { escapeHTML as esc } from './editor.js';
import { mountPicker } from './select-picker.js';

export function taskInsertion(source, headings, parentLine, position = 'append') {
  const index = parentLine ? headings.findIndex(h => h.line === Number(parentLine)) : -1;
  if (parentLine && index < 0) throw new Error('The selected parent heading no longer exists.');
  const parent = headings[index], level = parent ? parent.level + 1 : 1;
  const next = parent
    ? position === 'prepend' ? headings[index + 1] : headings.slice(index + 1).find(h => h.level <= parent.level)
    : position === 'prepend' ? headings[0] : null;
  const at = next ? source.split('\n').slice(0, next.line - 1).reduce((n, line) => n + line.length + 1, 0) : source.length;
  return { at, level };
}

// The caller supplies a snapshot ordered by open/recent use, not a live file list.
export function mountTaskDestination(root, files, readNote, memoryKey) {
  const input = root.querySelector('[name="path"]');
  if (!input || input.type === 'hidden') return () => {};
  const picker = mountPicker(input, {
    label: 'Org file',
    options: () => files.map(f => ({ value: f.path, label: f.path, detail: f.label || '' })),
    choose: option => { input.value = option.value; load(); },
    empty: 'No matching files. Enter a new .org path to create one.',
  });
  const parentLabel = document.createElement('label'); parentLabel.textContent = 'Parent heading';
  const parent = document.createElement('select'); parent.name = 'parentLine'; parentLabel.append(parent); picker.wrapper.closest('label').after(parentLabel);
  const revision = document.createElement('input'); revision.type = 'hidden'; revision.name = 'parentRevision'; parentLabel.append(revision);
  let sequence = 0, disposed = false;
  let memory = {};
  try { memory = JSON.parse(localStorage.getItem(memoryKey) || '{}'); } catch {}
  const placement = document.createElement('fieldset'); placement.className = 'task-insertion';
  placement.innerHTML = '<legend>Insert at this level</legend><div><label><input type="radio" name="insertionPosition" value="prepend">Prepend</label><label><input type="radio" name="insertionPosition" value="append">Append</label></div>';
  parentLabel.after(placement);
  const initial = memory.insertionPosition || (memory.parents?.[input.value.trim()] === 'start' ? 'prepend' : 'append');
  placement.querySelector(`[value="${initial === 'prepend' ? 'prepend' : 'append'}"]`).checked = true;
  placement.addEventListener('change', () => {
    memory.insertionPosition = placement.querySelector(':checked').value;
    if (memoryKey) localStorage.setItem(memoryKey, JSON.stringify(memory));
  });
  async function load() {
    const seq = ++sequence, path = input.value.trim();
    parent.onchange = null;
    parent.disabled = true; parent.innerHTML = '<option value="">Top level</option>'; revision.value = '';
    input.setCustomValidity('');
    if (!files.some(f => f.path === path)) { parent.disabled = false; return; }
    input.setCustomValidity('Wait for the heading list to load.');
    try {
      const note = await readNote(path);
      if (disposed || seq !== sequence) return;
      parent.innerHTML += note.headings.map(h => `<option value="${h.line}">${esc('　'.repeat(Math.min(h.level - 1, 8)) + h.title)}</option>`).join('');
      revision.value = note.revision; input.setCustomValidity(''); parent.disabled = false;
      const saved = memory.parents?.[path];
      const matches = saved?.title ? note.headings.filter(h => h.title === saved.title && h.level === saved.level) : [];
      const heading = matches.length === 1 ? matches[0] : matches.find(h => h.line === saved?.line);
      parent.value = heading ? String(heading.line) : '';
      parent.onchange = () => {
        const h = note.headings.find(h => String(h.line) === parent.value);
        memory.parents ||= {}; memory.parents[path] = h ? { title: h.title, level: h.level, line: h.line } : parent.value;
        memory.path = path;
        if (memoryKey) localStorage.setItem(memoryKey, JSON.stringify(memory));
      };
    } catch {
      if (!disposed && seq === sequence) input.setCustomValidity('Unable to load this file. Choose it again to retry.');
    }
  }
  input.addEventListener('input', load);
  const remember = () => {
    parent.onchange?.(); memory.path = input.value.trim();
    if (!parent.onchange) { memory.parents ||= {}; memory.parents[memory.path] = parent.value; }
    if (memoryKey) localStorage.setItem(memoryKey, JSON.stringify(memory));
  };
  const form = root.closest('form'); form?.addEventListener('submit', remember);
  load();
  return () => { disposed = true; sequence++; picker.dispose(); input.removeEventListener('input', load); form?.removeEventListener('submit', remember); };
}
