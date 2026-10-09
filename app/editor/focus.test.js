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
