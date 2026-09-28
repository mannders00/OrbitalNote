const storageKey = 'orbitalnote-shortcuts-v1';
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function eventShortcut(event) {
  if (event.isComposing || ['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) return '';
  let key = event.key;
  if (event.altKey && /^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  if (key.length === 1) key = key.toUpperCase();
  if (key === ' ') key = 'Space';
  const mods = [];
  if (mac ? event.metaKey : event.ctrlKey) mods.push('Mod');
  if (mac && event.ctrlKey) mods.push('Ctrl');
  if (!mac && event.metaKey) mods.push('Meta');
  if (event.altKey) mods.push('Alt');
  if (event.shiftKey) mods.push('Shift');
  return [...mods, key].join('+');
}

export function shortcutLabel(binding) {
  return binding ? binding.replace('Mod+', mac ? '⌘ ' : 'Ctrl + ').replace('Ctrl+', 'Ctrl + ').replace('Meta+', 'Meta + ').replace('Alt+', mac ? '⌥ ' : 'Alt + ').replace('Shift+', 'Shift + ') : 'Not assigned';
}

export function createShortcuts(definitions, container, changed) {
  let overrides = {}, recording = '';
  try { overrides = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch {}
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) overrides = {};
  const values = new Map(definitions.map(d => [d.id, typeof overrides[d.id] === 'string' ? overrides[d.id] : d.key || '']));
  const message = container.querySelector('[data-shortcut-message]');
  const list = container.querySelector('[data-shortcut-list]');
  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(values)));
    recording = ''; render(); changed();
  }
  function render() {
    const query = container.querySelector('[data-shortcut-filter]').value.toLowerCase();
    list.replaceChildren();
    for (const definition of definitions.filter(d => d.label.toLowerCase().includes(query))) {
      const row = document.createElement('div'); row.className = 'shortcut-row';
      const label = document.createElement('span'); label.textContent = definition.label;
      const record = document.createElement('button'); record.type = 'button';
      record.dataset.shortcutId = definition.id;
      record.textContent = recording === definition.id ? 'Press shortcut…' : shortcutLabel(values.get(definition.id));
      record.setAttribute('aria-label', `Change shortcut: ${definition.label}`);
      record.addEventListener('click', () => {
        recording = definition.id; message.textContent = 'Press a shortcut. Escape cancels. Use Clear to remove a binding.';
        render(); list.querySelector(`[data-shortcut-id="${definition.id}"]`).focus();
      });
      const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Clear';
      clear.setAttribute('aria-label', `Clear shortcut: ${definition.label}`);
      clear.addEventListener('click', () => { values.set(definition.id, ''); persist(); message.textContent = 'Shortcut cleared.'; });
      row.append(label, record, clear); list.append(row);
    }
  }
  container.querySelector('[data-shortcut-filter]').addEventListener('input', render);
  container.querySelector('[data-shortcut-reset]').addEventListener('click', () => {
    for (const d of definitions) values.set(d.id, d.key || '');
    persist(); message.textContent = 'Default shortcuts restored.';
  });
  render();
  return {
    binding: id => values.get(id) || '',
    label: id => shortcutLabel(values.get(id)),
    match: event => {
      const shortcut = eventShortcut(event);
      return shortcut && definitions.find(d => values.get(d.id) === shortcut);
    },
    capture: event => {
      if (!recording) return false;
      if (!container.contains(event.target)) { recording = ''; render(); return false; }
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === 'Escape') { recording = ''; render(); message.textContent = 'Shortcut change cancelled.'; return true; }
      const shortcut = eventShortcut(event);
      if (!shortcut) return true;
      if (!event.metaKey && !event.ctrlKey && !event.altKey && !/^F\d{1,2}$/.test(event.key) && event.key !== 'Tab') {
        message.textContent = 'Use Cmd/Ctrl or Alt with a key, a function key, or Tab.'; return true;
      }
      const duplicate = definitions.find(d => d.id !== recording && values.get(d.id) === shortcut);
      if (duplicate) { message.textContent = `Already assigned to ${duplicate.label}. Clear that shortcut first.`; return true; }
      values.set(recording, shortcut); persist(); message.textContent = 'Shortcut saved on this device.';
      return true;
    },
  };
}
