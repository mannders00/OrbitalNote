import { test, expect } from 'bun:test';
import { eventLanes, formatTimeRange } from './calendar.js';

const entry = (time, endTime) => ({ stamp: { time, endTime } });
test('overlapping timed blocks share lanes, adjacent blocks reclaim full width', () => {
  const blocks = eventLanes([entry('09:00', '10:30'), entry('09:30', '10:00'), entry('10:00', '11:00'), entry('11:00', '12:00')]);
  expect(blocks.map(b => [b.start, b.end, b.lane, b.columns])).toEqual([
    [540, 630, 0, 2], [570, 600, 1, 2], [600, 660, 1, 2], [660, 720, 0, 1],
  ]);
});
test('time-only appointments get an hour without extending past midnight', () => {
  expect(eventLanes([entry('23:30')]).map(b => [b.start, b.end])).toEqual([[1410, 1440]]);
  expect(eventLanes([entry('10:00', '09:00')])).toEqual([]);
});
test('time ranges retain noon/midnight context and the selected clock format', () => {
  expect(formatTimeRange('09:00', '10:30')).toBe('9:00–10:30 AM');
  expect(formatTimeRange('11:30', '13:00')).toBe('11:30 AM–1:00 PM');
  expect(formatTimeRange('00:00', '00:30')).toBe('12:00–12:30 AM');
  expect(formatTimeRange('12:00', '13:00')).toBe('12:00–1:00 PM');
  expect(formatTimeRange('09:00', '10:30', '24')).toBe('09:00–10:30');
  expect(formatTimeRange('09:00', '')).toBe('9:00 AM');
  expect(formatTimeRange('', '')).toBe('');
});
