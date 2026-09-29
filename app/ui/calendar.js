import { escapeHTML as esc } from './editor.js';

const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const clock = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Partition overlapping appointments into lanes within each connected overlap
// cluster. A block's height is its actual duration, including short meetings.
export function eventLanes(entries) {
  const events = entries.map(entry => ({ entry, start: minutes(entry.stamp.time), end: entry.stamp.endTime ? minutes(entry.stamp.endTime) : Math.min(1440, minutes(entry.stamp.time) + 60) })).filter(event => event.end > event.start).sort((a, b) => a.start - b.start || a.end - b.end);
  let cluster = [], end = -1, lanes = [];
  const flush = () => { for (const event of cluster) event.columns = lanes.length; cluster = []; lanes = []; };
  for (const event of events) {
    if (event.start >= end) flush();
    let lane = lanes.findIndex(value => value <= event.start); if (lane < 0) lane = lanes.length;
    lanes[lane] = event.end; event.lane = lane; cluster.push(event); end = Math.max(end, event.end);
  }
  flush(); return events;
}

export function timeGrid(start, days, entries, colorStyle, indexOf = entry => entries.indexOf(entry)) {
  const dates = Array.from({ length: days }, (_, i) => { const day = new Date(start); day.setDate(start.getDate() + i); return day; });
  const onDay = date => entries.filter(e => e.stamp.date && e.stamp.date <= date && (e.stamp.endDate || e.stamp.date) >= date);
  const task = (entry, cls, style = '') => `<button class="${cls} ${entry.done ? 'completed' : ''}" ${colorStyle(entry)} draggable="false" data-entry="${indexOf(entry)}" data-open="${esc(entry.path)}" data-line="${entry.line}" ${style} title="${esc(entry.title)}">${esc(entry.stamp.time || '')}${entry.stamp.endTime ? '–' + esc(entry.stamp.endTime) : ''} ${esc(entry.title)}</button>`;
  let html = `<div class="time-calendar" style="--days:${days}"><div class="calendar-pinned-header"><div class="time-day-headers"><span></span>${dates.map(day => `<button class="time-day-header ${dateKey(day) === dateKey(new Date()) ? 'is-today' : ''}" data-capture="${dateKey(day)}">${esc(day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }))}</button>`).join('')}</div><div class="all-day-row"><span>All day</span>${dates.map(day => `<div data-drop-date="${dateKey(day)}">${onDay(dateKey(day)).filter(e => !e.stamp.time || e.stamp.endDate).map(e => task(e, 'calendar-event')).join('')}</div>`).join('')}</div></div><div class="time-grid"><div class="time-labels">${Array.from({ length: 24 }, (_, h) => `<span style="top:${h * 60}px">${clock(h * 60)}</span>`).join('')}</div>`;
  for (const day of dates) {
    const date = dateKey(day), scheduled = onDay(date).filter(e => e.stamp.time && !e.stamp.endDate);
    html += `<div class="time-day ${date === dateKey(new Date()) ? 'is-today' : ''}" data-drop-date="${date}" data-time-date="${date}">${Array.from({ length: 48 }, (_, i) => `<button class="time-slot" style="top:${i * 30}px" data-capture="${date}" data-time="${clock(i * 30)}" aria-label="New task ${date} at ${clock(i * 30)}"></button>`).join('')}`;
    for (const event of eventLanes(scheduled)) {
      const { entry, start, end, lane, columns } = event;
      // Geometry is separate from tag color's style attribute.
      const editable = entry.stamp.kind !== 'completed';
      html += `<div class="time-block" style="top:${start}px;height:${end - start}px;left:${lane / columns * 100}%;width:${100 / columns}%">${task(entry, 'timed-event')}${editable ? `<span class="event-resize start" data-resize="start" data-entry="${indexOf(entry)}" title="Drag to change start time"></span><span class="event-resize end" data-resize="end" data-entry="${indexOf(entry)}" title="Drag to change end time"></span>` : ''}</div>`;
    }
    html += '</div>';
  }
  return html + '</div></div>';
}

// Pointer gestures work for mouse, pen and touch; ordinary event clicks still open notes.
export function bindCalendarGestures(root, { entry, create, change }) {
  let gesture, suppressClick = false;
  const snap = (column, y) => Math.max(0, Math.min(1425, Math.round((y - column.getBoundingClientRect().top) / column.getBoundingClientRect().height * 1440 / 15) * 15));
  const cleanup = () => { root.querySelectorAll('.calendar-drag-preview').forEach(el => el.remove()); root.classList.remove('calendar-dragging'); };
  root.addEventListener('click', e => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
    const cell = e.target.closest('.all-day-row [data-drop-date]');
    if (cell && !e.target.closest('[data-entry]')) { e.stopPropagation(); create(cell.dataset.dropDate, '', ''); }
  }, true);
  root.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !e.target.closest('.time-calendar')) return;
    suppressClick = false;
    const target = e.target.closest('[data-entry]'), item = target ? entry(Number(target.dataset.entry)) : null;
    const column = e.target.closest('.time-day'), allDay = e.target.closest('.all-day-row [data-drop-date]');
    if (!column && !allDay) return;
    if (item && (item.stamp.kind === 'completed' || item.stamp.endDate)) return;
    if (!item && !column) return;
    const start = column ? snap(column, e.clientY) : 0;
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, item, column, start, resize: target?.dataset.resize, offset: item?.stamp.time && column ? start - minutes(item.stamp.time) : 0 };
  });
  root.addEventListener('pointermove', e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5) return;
    if (!g.moved) root.setPointerCapture(e.pointerId);
    g.moved = true; e.preventDefault(); cleanup(); root.classList.add('calendar-dragging');
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const cell = hit?.closest('.time-day, .all-day-row [data-drop-date]');
    g.value = null;
    if (!cell || !root.contains(cell)) return;
    const timed = cell.classList.contains('time-day');
    if (!timed && (!g.item || g.resize)) return;
    let start, end;
    if (timed) {
      const at = snap(cell, e.clientY);
      if (g.resize) {
        if (cell !== g.column) return;
        start = minutes(g.item.stamp.time); end = g.item.stamp.endTime ? minutes(g.item.stamp.endTime) : Math.min(1439, start + 60);
        if (g.resize === 'start') start = Math.max(0, Math.min(at, end - 15)); else end = Math.min(1439, Math.max(start + 15, at));
      } else if (g.item) {
        const duration = g.item.stamp.endTime && g.item.stamp.time ? minutes(g.item.stamp.endTime) - minutes(g.item.stamp.time) : 60;
        start = Math.max(0, Math.min(1439 - duration, at - g.offset)); end = start + duration;
      } else { if (cell !== g.column) return; start = Math.min(g.start, at); end = Math.min(1439, Math.max(g.start, at) + 15); }
    }
    g.value = { date: cell.dataset.dropDate, time: timed ? clock(start) : '', endTime: timed ? clock(end) : '' };
    const preview = document.createElement('div'); preview.className = 'calendar-drag-preview';
    preview.textContent = timed ? `${clock(start)}–${clock(end)}` : 'All day';
    if (timed) Object.assign(preview.style, { top: `${start}px`, height: `${end - start}px` });
    cell.append(preview);
  });
  root.addEventListener('pointerup', e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture; gesture = null; cleanup();
    if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
    if (!g.moved) return;
    suppressClick = true;
    if (g.value) { if (g.item) change(g.item, g.value); else create(g.value.date, g.value.time, g.value.endTime); }
  });
  root.addEventListener('pointercancel', () => { gesture = null; cleanup(); });
}
