import { test, expect } from 'bun:test';
import { matchesAgendaQuery } from './agenda-query.js';
const entry = { path: 'notes/work.org', title: 'Plan', state: 'NEXT', tags: ['work'], fileTags: ['team'], stamp: { kind: 'scheduled', date: '2026-09-28' } };
const rule = (field, value, operator = 'is') => ({ field, value, operator });
test('combines exact tags, inherited tags, custom states and files', () => {
  expect(matchesAgendaQuery(entry, { rules: [rule('tag', 'team'), rule('state', 'NEXT'), rule('file', entry.path)] })).toBe(true);
  expect(matchesAgendaQuery(entry, { rules: [rule('tag', 'tea')] })).toBe(false);
  expect(matchesAgendaQuery(entry, { rules: [rule('tag', 'work', 'not')] })).toBe(false);
});
test('any/all and empty query behavior', () => {
  const rules = [rule('tag', 'personal'), rule('type', 'scheduled')];
  expect(matchesAgendaQuery(entry, { rules, mode: 'any' })).toBe(true);
  expect(matchesAgendaQuery(entry, { rules, mode: 'all' })).toBe(false);
  expect(matchesAgendaQuery(entry, { rules: [], mode: 'any' })).toBe(true);
});
test('date comparisons exclude undated entries and preserve boundaries', () => {
  expect(matchesAgendaQuery(entry, { rules: [rule('date', '2026-09-29', 'before')] })).toBe(true);
  expect(matchesAgendaQuery(entry, { rules: [rule('date', '2026-09-28', 'before')] })).toBe(false);
  expect(matchesAgendaQuery({ ...entry, stamp: { kind: 'todo' } }, { rules: [rule('date', '2026-09-29', 'before')] })).toBe(false);
});
