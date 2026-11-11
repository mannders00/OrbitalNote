import { escapeHTML as esc } from './editor.js';
import { icon } from './icons.js';
import { taskTitleHTML } from './task-links.js';

export function formatTime(time, format = '12') {
  if (!time || format === '24') return time || '';
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
export function formatTimeRange(time, endTime, format = '12') {
  if (!time) return '';
  const start = formatTime(time, format), end = formatTime(endTime, format);
  if (!end) return start;
  return `${format === '12' && start.slice(-2) === end.slice(-2) ? start.slice(0, -3) : start}–${end}`;
}
export function calendarClock(entry) {
  if (entry.projected) return '<span class="calendar-clock" role="img" aria-label="Projected occurrence" title="Projected occurrence; completion may change future dates">↻</span>';
  return entry.clock ? `<span class="calendar-clock" role="img" aria-label="Clock running" title="Clock running">${icon('clock')}</span>` : '';
}
export function calendarEventHTML(entry, format = '12') {
  const time = formatTimeRange(entry.stamp.time, entry.stamp.endTime, format);
  return `<span class="calendar-event-title">${calendarClock(entry)}${taskTitleHTML(entry.title, entry.path)}</span>${time ? `<span class="calendar-event-time">${esc(time)}</span>` : ''}`;
}
export function calendarEventLabel(entry, format = '12') {
  return `${entry.title} · ${formatTimeRange(entry.stamp.time, entry.stamp.endTime, format) || 'All day'} · ${entry.path}`;
}
export function updateNowLine(root, format = '12', now = new Date()) {
  for (const day of root.querySelectorAll('.time-day')) {
    const line = day.querySelector('.calendar-now-line'); if (!line) continue;
    line.hidden = day.dataset.timeDate !== dateKey(now);
    if (!line.hidden) { line.style.top = `${now.getHours() * 60 + now.getMinutes()}px`; line.setAttribute('aria-label', `Current time ${formatTime(clock(now.getHours()*60+now.getMinutes()), format)}`); }
  }
}

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

export function timeGrid(start, days, entries, colorStyle, indexOf = entry => entries.indexOf(entry), format = '12', allDayCollapsed = false) {
  const dates = Array.from({ length: days }, (_, i) => { const day = new Date(start); day.setDate(start.getDate() + i); return day; });
  const onDay = date => entries.filter(e => e.stamp.date && e.stamp.date <= date && (e.stamp.endDate || e.stamp.date) >= date);
  const task = (entry, cls) => `<div role="group" tabindex="0" aria-label="Open task: ${esc(calendarEventLabel(entry, format))}" class="${cls} ${esc(entry.stamp.kind)} ${entry.done ? 'completed' : ''} ${entry.clock ? 'is-clocked' : ''}" ${colorStyle(entry)} draggable="false" data-entry="${indexOf(entry)}" data-open="${esc(entry.path)}" data-line="${entry.line}" title="${esc(calendarEventLabel(entry, format))}">${calendarEventHTML(entry, format)}</div>`;
  const firstDate = dateKey(dates[0]), lastDate = dateKey(dates.at(-1));
  const allDayCount = entries.filter(e => (!e.stamp.time || e.stamp.endDate) && e.stamp.date && e.stamp.date <= lastDate && (e.stamp.endDate || e.stamp.date) >= firstDate).length;
  let html = `<div class="time-calendar ${days === 1 ? 'single-day' : ''}" style="--days:${days}"><div class="calendar-pinned-header"><div class="time-day-headers"><span></span>${dates.map(day => {
    const key = dateKey(day), current = key === dateKey(new Date());
    const label = day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return `<button class="time-day-header ${current ? 'is-today' : ''}" data-capture="${key}" ${current ? 'aria-current="date"' : ''} aria-label="Create task on ${esc(label)}" title="Create task on ${esc(label)}"><span class="calendar-weekday">${esc(day.toLocaleDateString(undefined, { weekday: 'short' }))}</span><span class="calendar-date-number">${day.getDate()}</span></button>`;
  }).join('')}</div><button class="all-day-toggle" data-all-day-toggle aria-expanded="${!allDayCollapsed}" aria-controls="calendar-all-day"><span aria-hidden="true">${allDayCollapsed ? '▸' : '▾'}</span> All day <span class="all-day-count">${allDayCount}</span></button><div id="calendar-all-day" class="all-day-row" ${allDayCollapsed ? 'hidden' : ''}><span></span>${dates.map(day => `<div data-key="${dateKey(day)}" data-drop-date="${dateKey(day)}">${onDay(dateKey(day)).filter(e => !e.stamp.time || e.stamp.endDate).map(e => `<div class="calendar-item">${task(e, 'calendar-event')}</div>`).join('')}</div>`).join('')}</div></div><div class="time-grid"><div class="time-labels">${Array.from({ length: 24 }, (_, h) => `<span style="top:${h * 60}px">${formatTime(clock(h * 60),format)}</span>`).join('')}</div>`;
  for (const day of dates) {
    const date = dateKey(day), scheduled = onDay(date).filter(e => e.stamp.time && !e.stamp.endDate);
    html += `<div class="time-day ${date === dateKey(new Date()) ? 'is-today' : ''}" data-key="${date}" data-drop-date="${date}" data-time-date="${date}">${Array.from({ length: 48 }, (_, i) => `<button class="time-slot" style="top:${i * 30}px" data-capture="${date}" data-time="${clock(i * 30)}" aria-label="New task ${date} at ${formatTime(clock(i * 30),format)}"></button>`).join('')}`;
    for (const event of eventLanes(scheduled)) {
      const { entry, start, end, lane, columns } = event;
      // Geometry is separate from tag color's style attribute.
      const editable = !entry.projected && entry.stamp.kind !== 'completed';
      html += `<div class="time-block ${end - start <= 30 ? 'is-short' : end - start < 60 ? 'is-compact' : ''}" data-key="${esc(entry.path+':'+entry.line+':'+entry.stamp.kind+':'+entry.stamp.date+':'+entry.stamp.time)}" style="top:${start}px;height:${end - start}px;left:${lane / columns * 100}%;width:${100 / columns}%">${task(entry, 'timed-event')}${editable ? `<span class="event-resize start" data-resize="start" data-entry="${indexOf(entry)}" title="Drag to change start time"></span><span class="event-resize end" data-resize="end" data-entry="${indexOf(entry)}" title="Drag to change end time"></span>` : ''}</div>`;
    }
    html += '<div class="calendar-now-line" hidden role="img"></div></div>';
  }
  return html + '</div></div>';
}

// Pointer gestures work for mouse, pen and touch; ordinary event clicks still open notes.
export function bindCalendarGestures(root, { entry, create, change }) {
  let gesture, holdTimer, suppressClick = false;
  const snap = (column, y) => Math.max(0, Math.min(1425, Math.round((y - column.getBoundingClientRect().top) / column.getBoundingClientRect().height * 1440 / 15) * 15));
  // Creation selects the visible half-hour cells, rather than rounding the
  // pointer to the nearest resize/move increment inside those cells.
  const slotStart = (column, y) => Math.max(0, Math.min(1410, Math.floor((y - column.getBoundingClientRect().top) / column.getBoundingClientRect().height * 1440 / 30) * 30));
  const cleanup = () => { root.querySelectorAll('.calendar-drag-preview').forEach(el => el.remove()); root.classList.remove('calendar-dragging'); };
  const clearHold = () => { clearTimeout(holdTimer); root.querySelector('.calendar-touch-ready')?.classList.remove('calendar-touch-ready'); };
  // Let ordinary touch swipes scroll. Holding first retains creation, movement
  // and resizing on touch without turning every attempt to scroll into an edit.
  root.addEventListener('touchmove', e => { if (gesture?.ready && e.cancelable) e.preventDefault(); }, { passive: false });
  root.addEventListener('contextmenu', e => { if (gesture?.ready && e.target.closest('.time-calendar')) e.preventDefault(); });
  root.addEventListener('click', e => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
    const cell = e.target.closest('.all-day-row [data-drop-date]');
    if (cell && !e.target.closest('[data-entry]')) { e.stopPropagation(); create(cell.dataset.dropDate, '', ''); }
  }, true);
  root.addEventListener('pointerdown', e => {
    if (e.target.closest('[data-task-link]')) return;
    if (e.button !== 0 || !e.target.closest('.time-calendar')) return;
    suppressClick = false; clearHold();
    const target = e.target.closest('[data-entry]'), item = target ? entry(Number(target.dataset.entry)) : null;
    const column = e.target.closest('.time-day'), allDay = e.target.closest('.all-day-row [data-drop-date]');
    if (!column && !allDay) return;
    if (item && (item.projected || item.stamp.kind === 'completed' || item.stamp.endDate)) return;
    if (!item && !column) return;
    const start = column ? item ? snap(column, e.clientY) : slotStart(column, e.clientY) : 0;
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, item, column, start, touch: e.pointerType === 'touch', resize: target?.dataset.resize, offset: item?.stamp.time && column ? start - minutes(item.stamp.time) : 0 };
    if (gesture.touch) {
      const pending = gesture;
      holdTimer = setTimeout(() => {
        if (gesture !== pending) return;
        gesture.ready = true; (target || e.target.closest('.time-slot'))?.classList.add('calendar-touch-ready');
      }, 350);
    }
  });
  root.addEventListener('pointermove', e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture;
    if (g.touch && !g.ready) {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) { clearHold(); gesture = null; }
      return;
    }
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
      } else { if (cell !== g.column) return; const selected = slotStart(cell, e.clientY); start = Math.min(g.start, selected); end = Math.min(1439, Math.max(g.start, selected) + 30); }
    }
    g.value = { date: cell.dataset.dropDate, time: timed ? clock(start) : '', endTime: timed ? clock(end) : '' };
    const preview = document.createElement('div'); preview.className = 'calendar-drag-preview';
    preview.textContent = timed ? `${clock(start)}–${clock(end)}` : 'All day';
    if (timed) Object.assign(preview.style, { top: `${start}px`, height: `${end - start}px` });
    cell.append(preview);
  });
  root.addEventListener('pointerup', e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture; gesture = null; clearHold(); cleanup();
    if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
    if (!g.moved) return;
    suppressClick = true;
    if (g.value) { if (g.item) change(g.item, g.value); else create(g.value.date, g.value.time, g.value.endTime); }
  });
  root.addEventListener('pointercancel', () => { gesture = null; clearHold(); cleanup(); });
}
