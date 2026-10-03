import { test, expect } from 'bun:test';
import { reconcileOutline } from './outline.js';

const update = (previous, source) => reconcileOutline(previous, source, source.split('\n').flatMap((line, i) => {
  const h = /^(\*+) (.*)$/.exec(line);
  return h ? [{ line: i + 1, level: h[1].length, title: h[2] }] : [];
}));

test('inserting similar headers before nested duplicate headings keeps their identities', () => {
  const source = '* Parent\n** Repeated\n*** Leaf\n** Repeated\n* Other\n';
  const old = update(null, source);
  const next = update(old, '* New\n' + source.replace('*** Leaf', '*** New child\n*** Leaf'));
  for (const [before, after] of [[0, 1], [1, 2], [2, 4], [3, 5], [4, 6]]) expect(next.headings[after].key).toBe(old.headings[before].key);
  expect(next.headings[0].key).not.toBe(old.headings[0].key);
});

test('rename, body edits, and deleting an earlier heading retain surviving keys', () => {
  const old = update(null, '* First\n** Child\nbody\n* Last\n');
  const renamed = update(old, '* Renamed\n** Child\nbody\n* Last\n');
  expect(renamed.headings.map(h => h.key)).toEqual(old.headings.map(h => h.key));
  const next = update(renamed, '** Child\nmore body\n* Last\n');
  expect(next.headings.map(h => h.key)).toEqual(old.headings.slice(1).map(h => h.key));
});
