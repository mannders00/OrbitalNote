import { test, expect } from 'bun:test';
import { localNeighbors, localGraphHTML } from './local-graph.js';

test('local graph resolves relative Org links and combines duplicate incoming/outgoing edges', () => {
  const files = ['notes/Home.org', 'Other.org', 'notes/Child.org'].map(path => ({ path }));
  const links = ['file:../Other.org::*Target', 'file:../Other.org', 'Child.org', 'file:Missing.org', 'https://example.org', 'id:abc', 'file:Home.org'].map(target => ({ target }));
  const nodes = localNeighbors('notes/Home.org', links, [{ path: 'Other.org' }, { path: 'Other.org' }], files);
  expect(nodes).toHaveLength(2);
  expect(nodes.find(n => n.path === 'Other.org')).toEqual({ path: 'Other.org', incoming: true, outgoing: true });
  expect(nodes.find(n => n.path === 'notes/Child.org').outgoing).toBe(true);
});

test('graph bounds its drawing but retains all links and escapes note titles', () => {
  const nodes = Array.from({ length: 12 }, (_, i) => ({ path: `${i}<note>.org`, incoming: true, outgoing: false }));
  const html = localGraphHTML('Home.org', nodes);
  expect((html.match(/class="local-graph-node /g) || []).length).toBe(8);
  expect((html.match(/data-open=/g) || []).length).toBe(20);
  expect(html).not.toContain('<note>');
  expect(localGraphHTML('Home.org', [])).toContain('No linked notes yet');
});
