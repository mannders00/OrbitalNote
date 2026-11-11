import { escapeHTML as esc } from './editor.js';
import { icon } from './icons.js';
import { mountTaskDestination } from './task-destination.js';
import { repeatFields, mountTaskRepeat } from './task-repeat.js';

const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const civil = text => { const [y, m, d] = text.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const durationLabel = value => value < 60 ? `${value} min` : `${Math.floor(value / 60)} hr${value % 60 ? ` ${value % 60} min` : ''}`;
const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };

export async function taskDialog(dialog, { title = '', path = '', date = '', time = '', endTime = '', repeater = '', kind = 'scheduled', editing = false, inDocument = false, files = [], readNote, memoryKey } = {}) {
  if (document.getElementById('modal').open) return null;
  if (!date && !editing) date = key(new Date());
  const fixedLocation = editing || inDocument;
  const pending = dialog(editing ? 'Edit task' : 'New task', `
    <div class="task-form">
      <label class="task-title-field">Title<input name="title" required value="${esc(title)}"></label>
      <section class="task-schedule-fields" aria-label="Task schedule">
        <input type="hidden" name="date" value="${esc(date)}">
        <div class="task-date-picker">
          <div class="date-picker-header"><strong data-date-month aria-live="polite"></strong><div><button type="button" data-date-step="-1" aria-label="Previous month">${icon('left')}</button><button type="button" data-date-step="1" aria-label="Next month">${icon('right')}</button></div></div>
          <div class="date-picker-grid" role="group" aria-label="Choose date"></div>
          <div class="date-picker-actions"><span data-date-summary aria-live="polite"></span><div><button type="button" data-date-today>Today</button><button type="button" data-date-clear>No date</button></div></div>
        </div>
        <div class="task-planning task-segmented" role="radiogroup" aria-label="Planning type">
          ${[['event', 'Event', 'calendar'], ['scheduled', 'Scheduled', 'clock'], ['deadline', 'Deadline', 'flag']].map(([value, label, glyph]) => `<label><input type="radio" name="kind" value="${value}" ${kind === value ? 'checked' : ''}>${icon(glyph)}<span>${label}</span></label>`).join('')}
        </div>
      </section>
      <div class="task-options">
        <details class="task-destination">
          <summary class="task-option-row"><span class="task-option-label">${icon('folder')}Location</span><span class="task-location-summary" data-task-location>${esc(path)}</span>${icon('down')}</summary>
          <div class="task-destination-fields">
            ${fixedLocation ? `<input type="hidden" name="path" value="${esc(path)}"><p class="task-location">${esc(path)}</p><p class="task-field-hint">${inDocument ? 'Added at your cursor in this note.' : 'Editing the selected heading in this note.'}</p>` : `<label>Org file<input name="path" required value="${esc(path)}" placeholder="inbox.org"></label>`}
          </div>
        </details>
        ${repeatFields()}
      </div>
      <section class="task-time-section" aria-label="Time">
        <div class="task-times"><label>Start time<input type="time" name="time" step="60" value="${esc(time)}" aria-describedby="task-time-hint"></label><span class="task-time-arrow" aria-hidden="true">${icon('right')}</span><label>End time<input type="time" name="endTime" step="60" value="${esc(endTime)}" aria-describedby="task-time-hint"></label></div>
        <div class="task-time-footer"><p id="task-time-hint" class="task-field-hint" aria-live="polite"></p><button type="button" data-time-clear hidden>Clear time</button></div>
        <div class="time-presets" role="group" aria-label="Duration" hidden><span>Duration</span><button type="button" data-duration="30">30 min</button><button type="button" data-duration="60">1 hour</button><button type="button" data-duration="120">2 hours</button></div>
      </section>
    </div>`, editing ? 'Save task' : 'Create task');
  const root = document.getElementById('modal-body'), modal = root.closest('dialog');
  modal.classList.add('task-modal');
  let deleted = false;
  const deleteButton = editing ? document.createElement('button') : null;
  if (deleteButton) {
    deleteButton.type = 'button'; deleteButton.textContent = 'Delete';
    modal.querySelector('.modal-actions').prepend(deleteButton);
    deleteButton.addEventListener('click', () => {
      if (deleteButton.textContent !== 'Confirm') { deleteButton.textContent = 'Confirm'; return; }
      deleted = true; modal.close('cancel');
    });
  }
  const dateInput = root.querySelector('[name="date"]'), start = root.querySelector('[name="time"]'), end = root.querySelector('[name="endTime"]');
  const repeat = mountTaskRepeat(root, repeater);
  const disposeDestination = readNote ? mountTaskDestination(root, files, readNote, memoryKey) : () => {};
  const now = new Date(), today = key(now), grid = root.querySelector('.date-picker-grid');
  let month = date ? civil(date) : now, focusedDate = date || today;
  month = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  let duration = start.value && end.value && end.value > start.value ? minutes(end.value) - minutes(start.value) : 30;
  // Existing start-only timestamps stay start-only until the user changes a time.
  if (!editing && start.value && !end.value) setEnd();

  function draw(focus = false) {
    setText(root.querySelector('[data-date-month]'), month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
    const first = new Date(month); first.setDate(1 - (month.getDay() + 6) % 7);
    const days = Array.from({ length: 42 }, (_, i) => { const day = new Date(first); day.setDate(first.getDate() + i); return day; });
    if (!days.some(day => key(day) === focusedDate)) focusedDate = key(month);
    grid.innerHTML = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => `<span aria-hidden="true">${day}</span>`).join('') + days.map(day => {
      const value = key(day), label = day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return `<button type="button" data-date="${value}" class="${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${value === today ? 'today' : ''}" aria-label="${esc(label)}" aria-pressed="${value === dateInput.value}" ${value === today ? 'aria-current="date"' : ''} tabindex="${value === focusedDate ? '0' : '-1'}">${day.getDate()}</button>`;
    }).join('');
    setText(root.querySelector('[data-date-summary]'), dateInput.value ? civil(dateInput.value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date selected');
    root.querySelector('[data-date-clear]').setAttribute('aria-pressed', String(!dateInput.value));
    if (focus) grid.querySelector(`[data-date="${focusedDate}"]`)?.focus({ preventScroll: true });
  }
  function chooseDate(value, focus = false) {
    dateInput.value = value;
    if (value) {
      focusedDate = value;
      const selected = civil(value); month = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
    } else {
      start.value = ''; end.value = ''; duration = 30; repeat.clear();
    }
    refresh(); draw(focus);
  }
  function setEnd() {
    const value = start.value ? Math.min(1439, minutes(start.value) + duration) : 0;
    end.value = start.value && value > minutes(start.value) ? clock(value) : '';
  }
  function refresh() {
    const hasDate = !!dateInput.value, hasTime = !!start.value;
    start.disabled = end.disabled = !hasDate;
    const invalidEnd = end.value && (!hasTime || end.value <= start.value);
    end.setCustomValidity(invalidEnd ? 'Choose an end time after the start, on the same day.' : '');
    end.setAttribute('aria-invalid', String(!!invalidEnd));
    const hourly = repeat.value().endsWith('h');
    start.setCustomValidity(hourly && !hasTime ? 'Choose a start time for an hourly repeat.' : '');
    start.required = hourly;
    repeat.setDisabled(!hasDate);
    root.querySelector('[data-time-clear]').hidden = !hasTime && !end.value;
    root.querySelector('.time-presets').hidden = !hasTime;
    const actualDuration = hasTime && end.value && !invalidEnd ? minutes(end.value) - minutes(start.value) : 0;
    for (const button of root.querySelectorAll('[data-duration]')) {
      button.disabled = !hasTime || minutes(start.value) + Number(button.dataset.duration) > 1439;
      button.setAttribute('aria-pressed', String(actualDuration === Number(button.dataset.duration)));
    }
    const hint = root.querySelector('#task-time-hint');
    hint.classList.toggle('invalid', !!invalidEnd);
    const timeHint = !hasDate ? 'Choose a date to add a time or repeat.' : invalidEnd ? 'End time must be after the start, on the same day.' : hasTime && minutes(start.value) + duration > 1439 ? 'End times stay on the same day.' : actualDuration ? `${durationLabel(actualDuration)} · Adjust the end time or choose a duration.` : hourly && !hasTime ? 'Choose a start time for an hourly repeat.' : hasTime ? 'Start time only · Add an end time if you need one.' : 'All day · Choose a start time for a 30-minute block.';
    setText(hint, timeHint);
    const selectedKind = root.querySelector('[name="kind"]:checked')?.value || 'scheduled';
    setText(document.getElementById('modal-title'), `${editing ? 'Edit' : 'New'} ${selectedKind === 'event' ? 'event' : 'task'}`);
    setText(document.getElementById('modal-submit'), `${editing ? 'Save' : 'Create'} ${selectedKind === 'event' ? 'event' : 'task'}`);
  }
  const onClick = e => {
    const button = e.target.closest('button'); if (!button) return;
    if (button.dataset.date) chooseDate(button.dataset.date, true);
    if (button.dataset.dateStep) { month = new Date(month.getFullYear(), month.getMonth() + Number(button.dataset.dateStep), 1, 12); focusedDate = key(month); draw(); }
    if (button.hasAttribute('data-date-today')) chooseDate(today);
    if (button.hasAttribute('data-date-clear')) chooseDate('');
    if (button.dataset.duration) { duration = Number(button.dataset.duration); setEnd(); refresh(); }
    if (button.hasAttribute('data-time-clear')) { start.value = ''; end.value = ''; duration = 30; refresh(); }
  };
  const onInput = e => {
    if (!e.target.matches('[name="time"], [name="endTime"], [name="kind"], .task-repeat input, .task-repeat select')) return;
    if (e.target === start) setEnd();
    if (e.target === end && start.value && end.value > start.value) duration = minutes(end.value) - minutes(start.value);
    refresh();
  };
  const onKey = e => {
    const button = e.target.closest('[data-date]'); if (!button) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const day = civil(button.dataset.date);
    if (e.key in moves) day.setDate(day.getDate() + moves[e.key]);
    else if (e.key === 'Home') day.setDate(day.getDate() - (day.getDay() + 6) % 7);
    else if (e.key === 'End') day.setDate(day.getDate() + 6 - (day.getDay() + 6) % 7);
    else if (e.key === 'PageUp' || e.key === 'PageDown') {
      const original = day.getDate(); day.setDate(1); day.setMonth(day.getMonth() + (e.key === 'PageUp' ? -1 : 1));
      day.setDate(Math.min(original, new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate()));
    } else return;
    e.preventDefault(); e.stopPropagation(); focusedDate = key(day);
    month = new Date(day.getFullYear(), day.getMonth(), 1, 12); draw(true);
  };
  // Reveal a collapsed destination before native validation focuses its field.
  const onInvalid = e => { const details = e.target.closest('details'); if (details) details.open = true; };
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('keydown', onKey);
  root.addEventListener('invalid', onInvalid, true);
  draw(); refresh();
  try { const result = await pending; return deleted ? { deleteHeading: true } : result; }
  finally {
    deleteButton?.remove();
    disposeDestination(); repeat.dispose(); modal.classList.remove('task-modal');
    root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); root.removeEventListener('change', onInput);
    root.removeEventListener('keydown', onKey); root.removeEventListener('invalid', onInvalid, true);
  }
}
