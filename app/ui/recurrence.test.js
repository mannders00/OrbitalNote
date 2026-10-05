import { test, expect } from 'bun:test';
import { projectOccurrences } from './recurrence.js';
const task = (date, repeater, extra = {}) => ({ path: 'tasks.org', line: 1, title: 'Repeat', done: false, clock: 'running', stamp: { date, repeater, kind: 'scheduled', ...extra } });
test('weekly projections retain the real occurrence and never create completions or clocks', () => {
  const original = task('2026-10-05', '+1w');
  const result = projectOccurrences([original], '2026-10-05', '2026-11-02');
  expect(result.map(e => e.stamp.date)).toEqual(['2026-10-05','2026-10-12','2026-10-19','2026-10-26','2026-11-02']);
  expect(result[0]).toBe(original); expect(result.slice(1).every(e => e.projected && !e.done && !e.clock)).toBe(true);
  expect(original.stamp.date).toBe('2026-10-05');
});
test('month-end clamping, leap years, hourly duration, and completion-relative estimates', () => {
  expect(projectOccurrences([task('2028-01-31', '+1m')], '2028-02-01', '2028-03-31').map(e => e.stamp.date)).toEqual(['2028-01-31','2028-02-29','2028-03-29']);
  for (const repeat of ['++1w', '.+1w']) expect(projectOccurrences([task('2026-10-05', repeat)], '2026-10-05', '2026-10-12')[1].projected).toBe(true);
  const hourly = projectOccurrences([task('2026-10-05', '+2h', { time: '22:30', endTime: '23:30' })], '2026-10-06', '2026-10-06');
  expect(hourly[1].stamp.time).toBe('00:30'); expect(hourly[1].stamp.endTime).toBe('01:30');
  expect(projectOccurrences([{ ...task('2026-10-05', '+1d'), done: true }], '2026-10-05', '2026-11-05')).toHaveLength(1);
});
