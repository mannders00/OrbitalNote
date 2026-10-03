import { test, expect } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { SearchQuery } from '@codemirror/search';
import { searchScope, setSearchScope, inSearchScope } from './search.js';

const matches = (state, query) => [...query.getCursor(state)];
test('selection-scoped regex includes only complete matches and maps through edits', () => {
  let state = EditorState.create({ doc: 'cat1 cat2 cat3', extensions: [searchScope] });
  state = state.update({ effects: setSearchScope.of({ from: 5, to: 9 }) }).state;
  const query = new SearchQuery({ search: 'cat(\\d)', regexp: true, test: inSearchScope });
  expect(matches(state, query).map(m => [m.from, m.to])).toEqual([[5, 9]]);
  state = state.update({ changes: { from: 5, to: 9, insert: 'cat22' } }).state;
  expect(state.field(searchScope)).toEqual({ from: 5, to: 10 });
  expect(matches(state, query).map(m => [m.from, m.to])).toEqual([[5, 9]]);
  const crossing = new SearchQuery({ search: 'cat22 cat3', test: inSearchScope });
  expect(matches(state, crossing)).toEqual([]);
});

test('invalid patterns are rejected and zero-width matches terminate', () => {
  expect(new SearchQuery({ search: '[', regexp: true }).valid).toBe(false);
  const state = EditorState.create({ doc: 'one\ntwo\nthree', extensions: [searchScope] });
  const query = new SearchQuery({ search: '^', regexp: true, test: inSearchScope });
  expect(matches(state, query).map(m => m.from)).toEqual([0, 4, 8]);
});
