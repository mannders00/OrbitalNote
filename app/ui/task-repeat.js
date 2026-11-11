import { icon } from './icons.js';

export function repeatFields() {
  return `<div class="task-repeat">
    <input type="hidden" name="repeater">
    <label class="task-option-row"><span class="task-option-label">${icon('repeat')}Repeat</span><select data-repeat-preset data-native aria-label="Repeat"><option value="">Does not repeat</option><option value="+1d">Every day</option><option value="+1w">Every week</option><option value="+1m">Every month</option><option value="+1y">Every year</option><option value="custom">Custom…</option></select></label>
    <div class="task-repeat-custom" hidden>
      <div class="task-repeat-interval"><span>Every</span><input type="number" data-repeat-count min="1" step="1" value="1" required aria-label="Repeat interval"><select data-repeat-unit data-native aria-label="Repeat unit"><option value="h">hours</option><option value="d">days</option><option value="w" selected>weeks</option><option value="m">months</option><option value="y">years</option></select></div>
      <label>Repeat from<select data-repeat-mode data-native aria-describedby="task-repeat-hint"><option value="+">Original date</option><option value="++">Next future date</option><option value=".+">Completion date</option></select></label>
      <p id="task-repeat-hint" class="task-field-hint"></p>
    </div>
  </div>`;
}

export function mountTaskRepeat(root, value) {
  const section = root.querySelector('.task-repeat'), hidden = section.querySelector('[name="repeater"]');
  const preset = section.querySelector('[data-repeat-preset]'), custom = section.querySelector('.task-repeat-custom');
  const count = section.querySelector('[data-repeat-count]'), unit = section.querySelector('[data-repeat-unit]'), mode = section.querySelector('[data-repeat-mode]');
  const match = /^(\+\+|\.\+|\+)([1-9]\d*)([hdwmy])$/.exec(value);
  if (match) { mode.value = match[1]; count.value = match[2]; unit.value = match[3]; }
  preset.value = [...preset.options].some(option => option.value === value) ? value : 'custom';
  const names = { h: 'hour', d: 'day', w: 'week', m: 'month', y: 'year' };
  const hints = { '+': 'Move forward one interval each time you complete it.', '++': 'Keep the original rhythm, skipping dates that have passed.', '.+': 'Start the next interval from when you complete it.' };
  function sync() {
    const isCustom = preset.value === 'custom';
    custom.hidden = !isCustom;
    for (const input of [count, unit, mode]) input.disabled = preset.disabled || !isCustom;
    const interval = Number(count.value), valid = Number.isSafeInteger(interval) && interval > 0;
    count.setCustomValidity(valid ? '' : 'Choose a whole number of at least 1.');
    const customValue = valid ? `${mode.value}${interval}${unit.value}` : '';
    hidden.value = preset.disabled ? '' : isCustom ? customValue : preset.value;
    section.querySelector('#task-repeat-hint').textContent = hints[mode.value];
    const label = `Every ${interval === 1 ? '' : interval + ' '}${names[unit.value]}${interval === 1 ? '' : 's'}`;
    preset.querySelector('[value="custom"]').textContent = isCustom && valid ? `${label} · Custom` : 'Custom…';
  }
  section.addEventListener('input', sync); section.addEventListener('change', sync);
  sync();
  return {
    value: () => hidden.value,
    clear() { preset.value = ''; sync(); },
    setDisabled(disabled) { if (preset.disabled !== disabled) { preset.disabled = disabled; sync(); } },
    dispose() { section.removeEventListener('input', sync); section.removeEventListener('change', sync); },
  };
}
