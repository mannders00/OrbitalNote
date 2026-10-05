const dayKey = date => date.toISOString().slice(0, 10);
const clockKey = date => date.toISOString().slice(11, 16);
function advance(date, count, unit) {
  const next = new Date(date);
  if (unit === 'h') next.setUTCHours(next.getUTCHours() + count);
  else if (unit === 'd' || unit === 'w') next.setUTCDate(next.getUTCDate() + count * (unit === 'w' ? 7 : 1));
  else {
    const day = next.getUTCDate(); next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + count * (unit === 'y' ? 12 : 1));
    const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate(); next.setUTCDate(Math.min(day, last));
  }
  return next;
}

// Display projections only: no source headings or completion history are created.
// Completion-relative repeaters remain estimates until the task is completed.
export function projectOccurrences(entries, from, through) {
  const result = [...entries];
  for (const entry of entries) {
    const stamp = entry.stamp, match = /^(\+\+|\.\+|\+)([1-9]\d*)([hdwmy])$/.exec(stamp.repeater || '');
    if (!match || entry.done || !['scheduled', 'deadline'].includes(stamp.kind) || stamp.endDate) continue;
    const count = Number(match[2]), unit = match[3]; if (count > 10000 || unit === 'h' && !stamp.time) continue;
    let date = new Date(`${stamp.date}T${stamp.time || '00:00'}:00Z`); if (!Number.isFinite(+date)) continue;
    const duration = stamp.endTime && stamp.time ? (Number(stamp.endTime.slice(0,2)) - Number(stamp.time.slice(0,2))) * 60 + Number(stamp.endTime.slice(3)) - Number(stamp.time.slice(3)) : 0;
    const step = unit === 'h' ? count * 3600000 : unit === 'd' || unit === 'w' ? count * (unit === 'w' ? 7 : 1) * 86400000 : 0;
    if (step) { const skip = Math.max(0, Math.floor((Date.parse(from + 'T00:00:00Z') - +date) / step) - 1); date = new Date(+date + skip * step); }
    for (let i = 0; i < 20000; i++) {
      date = advance(date, count, unit);
      if (!Number.isFinite(+date) || dayKey(date) > through) break;
      if (dayKey(date) < from) continue;
      const end = new Date(+date + duration * 60000);
      result.push({ ...entry, clock: '', projected: true, stamp: { ...stamp, date: dayKey(date), time: stamp.time ? clockKey(date) : '', endTime: stamp.endTime ? clockKey(end) : '', ...(duration && dayKey(end) !== dayKey(date) ? { endDate: dayKey(end) } : {}) } });
    }
  }
  return result.sort((a,b) => (a.stamp.date || '').localeCompare(b.stamp.date || '') || (a.stamp.time || '').localeCompare(b.stamp.time || '') || a.path.localeCompare(b.path) || a.line - b.line);
}
