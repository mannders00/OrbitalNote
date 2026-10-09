import { test, expect } from 'bun:test';
import { headingRanges, listRanges } from './headings.js';

test('folds contain descendants but never the next sibling heading', () => {
  const source = '* Parent\nBody\n** Child\nChild body\n* Sibling\nLast body';
  const [parent, child, sibling] = headingRanges(source);
  expect(source.slice(parent.from, parent.to)).toBe('\nBody\n** Child\nChild body');
  expect(source.slice(child.from, child.to)).toBe('\nChild body');
  expect(source.slice(sibling.from, sibling.to)).toBe('\nLast body');
});
test('block examples and drawer contents do not end a subtree', () => {
  const source = '* Real\n#+begin_src org\n* Fake\n#+end_src\n:PROPERTIES:\n* Also fake\n:END:\n** Child\ntext';
  expect(headingRanges(source).map(h => h.title)).toEqual(['Real', 'Child']);
});
test('empty headings have no fold range; CRLF offsets preserve source', () => {
  const [empty, body] = headingRanges('* Empty\r\n* Body\r\nuntouched\r\n');
  expect(empty.from).toBe(empty.to);
  expect(body.from).toBe(16);
});
test('list folds include nested checklists and continuation text without swallowing siblings', () => {
  const source = '* H\n- [ ] Parent\n  prose\n\n  1. Child\n     - Grandchild\n- Sibling\n* Next\n';
  const items = listRanges(source);
  expect(items.map(i => i.title)).toEqual(['[ ] Parent', 'Child', 'Grandchild', 'Sibling']);
  expect(source.slice(items[0].from, items[0].to)).toBe('\n  prose\n\n  1. Child\n     - Grandchild');
  expect(source.slice(items[1].from, items[1].to)).toBe('\n     - Grandchild');
  expect(items[3].from).toBe(items[3].to);
});
test('list examples in blocks and drawers are opaque and CRLF offsets are retained', () => {
  const source = '#+begin_src org\r\n- fake\r\n#+end_src\r\n:LOGBOOK:\r\n- fake\r\n:END:\r\n- Real\r\n  - Child\r\n';
  const items = listRanges(source);
  expect(items.map(i => i.title)).toEqual(['Real', 'Child']);
  expect(source.slice(items[0].from, items[0].to)).toBe('\r\n  - Child');
});
