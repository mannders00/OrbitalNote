import { test, expect } from 'bun:test';
import { eventLanes } from './calendar.js';

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
