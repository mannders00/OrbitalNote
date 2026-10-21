import { test, expect } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { headingFocus, focusEffect, focusRange, externalEdit } from './focus.js';

test('focused edits protect surrounding text and map through shared external edits', () => {
  let state = EditorState.create({ doc: '* Before\nbody\n* Focus\ninside\n* After\nbody', extensions: headingFocus });
  state = state.update({ effects: focusEffect.of({ from: 14, to: 28 }), selection: { anchor: 14 } }).state;
  expect(state.update({ changes: { from: 0, insert: 'bad' } }).docChanged).toBe(false);
  state = state.update({ changes: { from: 0, insert: 'external\n' }, annotations: externalEdit.of(true) }).state;
  expect(state.field(focusRange)).toEqual({ from: 23, to: 37 });
  state = state.update({ selection: { anchor: 0, head: state.doc.length } }).state;
  expect(state.selection.main.from).toBe(23); expect(state.selection.main.to).toBe(37);
  state = state.update({ changes: { from: 30, insert: 'edit' } }).state;
  expect(state.field(focusRange).to).toBe(41);
  expect(state.doc.toString().endsWith('* After\nbody')).toBe(true);
});
test('focused structure keeps its root and expands shallow headings into children', () => {
  const doc = '* Parent\n** Focus\nBody\n*** Child\n* Outside';
  let state = EditorState.create({ doc, extensions: headingFocus });
  const from = doc.indexOf('** Focus'), to = doc.indexOf('\n* Outside');
  state = state.update({ effects: focusEffect.of({ from, to }) }).state;
  expect(state.update({ changes: { from, to: from + 1 } }).docChanged).toBe(false);
  expect(state.update({ changes: { from, to: from + 3 } }).docChanged).toBe(false);
  const insertAt = doc.indexOf('Body');
  state = state.update({ changes: { from: insertAt, insert: '* New\n' }, selection: { anchor: insertAt + 5 } }).state;
  expect(state.doc.toString()).toContain('*** New\nBody');
  expect(state.selection.main.head).toBe(insertAt + 7);
  const child = state.doc.toString().indexOf('*** Child');
  state = state.update({ changes: { from: child, to: child + 1 } }).state;
  expect(state.doc.toString()).toContain('*** Child');
  expect(state.doc.toString().endsWith('* Outside')).toBe(true);
});
test('focused marker normalization leaves source-block examples alone', () => {
  const doc = '** Focus\n#+begin_src org\n* Example\n#+end_src\n';
  let state = EditorState.create({ doc, extensions: headingFocus });
  state = state.update({ effects: focusEffect.of({ from: 0, to: doc.length }) }).state;
  state = state.update({ changes: { from: doc.indexOf('Example'), insert: 'New ' } }).state;
  expect(state.doc.toString()).toContain('* New Example');
});
