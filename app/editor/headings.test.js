import { test, expect } from 'bun:test';
import { headingRanges } from './headings.js';

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
