import { test, expect } from 'bun:test';
import { EditorState, StateField } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { collapsedLinks, linkAt } from './links.js';

test('source links reveal on cursor entry and selections without changing text', () => {
  const doc = 'See [[file:note.org][My note]] and [[https://example.com]].';
  const styles = StateField.define({
    create: state => Decoration.set([...state.doc.toString().matchAll(/\[\[[^\]]+\](?:\[[^\]]*\])?\]/g)].map(m => Decoration.mark({ class: 'org-link' }).range(m.index, m.index + m[0].length))),
    update: (value, tr) => value.map(tr.changes),
  });
  const links = collapsedLinks(styles);
  let state = EditorState.create({ doc, extensions: [styles, links] });
  const visible = () => {
    let result = '', end = 0;
    state.field(links).between(0, state.doc.length, (from, to) => { result += state.sliceDoc(end, from); end = to; });
    return result + state.sliceDoc(end);
  };
  expect(visible()).toBe('See My note and https://example.com.');
  state = state.update({ selection: { anchor: doc.indexOf('My note') } }).state;
  expect(visible()).toBe('See [[file:note.org][My note]] and https://example.com.');
  expect(linkAt(state)?.target).toBe('file:note.org');
  state = state.update({ selection: { anchor: 0, head: doc.length } }).state;
  expect(visible()).toBe(doc);
  state = state.update({ selection: { anchor: 0 } }).state;
  expect(visible()).toBe('See My note and https://example.com.');
  expect(state.doc.toString()).toBe(doc);
  expect(linkAt(state)).toBeNull();
});
