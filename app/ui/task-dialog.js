import { escapeHTML as esc } from './editor.js';
import { icon } from './icons.js';

const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const civil = text => { const [y, m, d] = text.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export async function taskDialog(dialog, { title = '', path = '', date = '', time = '', endTime = '', kind = 'scheduled', editing = false } = {}) {
  if (document.getElementById('modal').open) return null;
  const pending = dialog(editing ? 'Edit task' : 'New task', `
    <label>Title<input name="title" required value="${esc(title)}" placeholder="Task title"></label>
    ${editing ? `<p class="task-location">${esc(path)} · selected heading</p><input type="hidden" name="path" value="${esc(path)}">` : `<label>Org file<input name="path" required value="${esc(path)}" placeholder="inbox.org"></label>`}
    <div class="task-planning" role="group" aria-label="Planning type"><label><input type="radio" name="kind" value="scheduled" ${kind === 'scheduled' ? 'checked' : ''}>Scheduled</label><label><input type="radio" name="kind" value="deadline" ${kind === 'deadline' ? 'checked' : ''}>Deadline</label></div>
    <label>Date <small>optional</small><input name="date" value="${esc(date)}" placeholder="YYYY-MM-DD" inputmode="numeric" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"></label>
    <div class="task-date-picker"><div class="date-picker-header"><button type="button" data-date-step="-1" aria-label="Previous month">${icon('left')}</button><strong data-date-month></strong><button type="button" data-date-step="1" aria-label="Next month">${icon('right')}</button></div><div class="date-picker-grid" role="group" aria-label="Choose date"></div><div class="date-picker-actions"><button type="button" data-date-today>Today</button><button type="button" data-date-clear>No date</button></div></div>
    <div class="task-times"><label>Start time <small>optional</small><input type="time" name="time" value="${esc(time)}"></label><label>End time <small>optional</small><input type="time" name="endTime" value="${esc(endTime)}"></label></div><div class="time-presets" role="group" aria-label="Quick time choices"><button type="button" data-time="09:00">9 am</button><button type="button" data-time="12:00">Noon</button><button type="button" data-time="15:00">3 pm</button><button type="button" data-duration="30">30 minutes</button><button type="button" data-duration="60">1 hour</button><button type="button" data-time="">No time</button></div>`, editing ? 'Save task' : 'Create task');
  const root = document.getElementById('modal-body'), dateInput = root.querySelector('[name="date"]');
  const now = new Date();
  let month = /^\d{4}-\d{2}-\d{2}$/.test(date) ? civil(date) : now;
  month = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  function draw() {
    root.querySelector('[data-date-month]').textContent = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const start = new Date(month); start.setDate(1 - (month.getDay() + 6) % 7);
    let html = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => `<span>${day}</span>`).join('');
    for (let i = 0; i < 42; i++) {
      const day = new Date(start); day.setDate(start.getDate() + i); const value = key(day);
      html += `<button type="button" data-date="${value}" class="${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${value === key(now) ? 'today' : ''}" aria-label="${value}" aria-pressed="${value === dateInput.value}">${day.getDate()}</button>`;
    }
    root.querySelector('.date-picker-grid').innerHTML = html;
  }
  const onClick = e => {
    const button = e.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-time')) { root.querySelector('[name="time"]').value = button.dataset.time; root.querySelector('[name="endTime"]').value = ''; }
    if (button.dataset.duration) {
      const input = root.querySelector('[name="time"]'); if (!input.value) input.value = '09:00';
      const [h, m] = input.value.split(':').map(Number), end = Math.min(1439, h * 60 + m + Number(button.dataset.duration));
      root.querySelector('[name="endTime"]').value = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    }
    validate();
    if (button.dataset.date) { dateInput.value = button.dataset.date; validate(); draw(); }
    if (button.dataset.dateStep) { month = new Date(month.getFullYear(), month.getMonth() + Number(button.dataset.dateStep), 1, 12); draw(); }
    if (button.hasAttribute('data-date-today')) { dateInput.value = key(now); month = new Date(now.getFullYear(), now.getMonth(), 1, 12); validate(); draw(); }
    if (button.hasAttribute('data-date-clear')) { dateInput.value = ''; root.querySelector('[name="time"]').value = ''; root.querySelector('[name="endTime"]').value = ''; validate(); draw(); }
  };
  function validate() {
    const start = root.querySelector('[name="time"]'), end = root.querySelector('[name="endTime"]');
    const validDate = !dateInput.value || (/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value) && key(civil(dateInput.value)) === dateInput.value);
    dateInput.setCustomValidity(validDate ? '' : 'Enter a valid date.');
    start.setCustomValidity(start.value && !dateInput.value ? 'Choose a date for this time.' : '');
    end.setCustomValidity(end.value && (!start.value || end.value <= start.value) ? 'End time must be later than start time on the same day.' : '');
  }
  const onInput = () => { validate(); draw(); };
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  draw(); validate();
  try { return await pending; }
  finally { root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); }
}
