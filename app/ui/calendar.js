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
  const task = (entry, cls, style = '') => `<button class="${cls} ${entry.done ? 'completed' : ''}" ${colorStyle(entry)} draggable="${!entry.stamp.repeater && !entry.stamp.endDate}" data-entry="${indexOf(entry)}" data-open="${esc(entry.path)}" data-line="${entry.line}" ${style} title="${esc(entry.title)}">${esc(entry.stamp.time || '')}${entry.stamp.endTime ? '–' + esc(entry.stamp.endTime) : ''} ${esc(entry.title)}</button>`;
  let html = `<div class="time-calendar" style="--days:${days}"><div class="time-day-headers"><span></span>${dates.map(day => `<button class="time-day-header ${dateKey(day) === dateKey(new Date()) ? 'is-today' : ''}" data-capture="${dateKey(day)}">${esc(day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }))}</button>`).join('')}</div><div class="all-day-row"><span>All day</span>${dates.map(day => `<div data-drop-date="${dateKey(day)}">${onDay(dateKey(day)).filter(e => !e.stamp.time || e.stamp.endDate).map(e => task(e, 'calendar-event')).join('')}</div>`).join('')}</div><div class="time-grid"><div class="time-labels">${Array.from({ length: 24 }, (_, h) => `<span style="top:${h * 60}px">${clock(h * 60)}</span>`).join('')}</div>`;
  for (const day of dates) {
    const date = dateKey(day), scheduled = onDay(date).filter(e => e.stamp.time && !e.stamp.endDate);
    html += `<div class="time-day ${date === dateKey(new Date()) ? 'is-today' : ''}" data-drop-date="${date}" data-time-date="${date}">${Array.from({ length: 48 }, (_, i) => `<button class="time-slot" style="top:${i * 30}px" data-capture="${date}" data-time="${clock(i * 30)}" aria-label="New task ${date} at ${clock(i * 30)}"></button>`).join('')}`;
    for (const event of eventLanes(scheduled)) {
      const { entry, start, end, lane, columns } = event;
      // Geometry is separate from tag color's style attribute.
      html += `<div class="time-block" style="top:${start}px;height:${end - start}px;left:${lane / columns * 100}%;width:${100 / columns}%">${task(entry, 'timed-event')}</div>`;
    }
    html += '</div>';
  }
  return html + '</div></div>';
}
