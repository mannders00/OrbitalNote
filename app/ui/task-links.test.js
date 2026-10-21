import { test, expect } from 'bun:test';
import { taskTitleHTML } from './task-links.js';

test('task links keep labels, escape content, and do not expose executable schemes', () => {
  const html = taskTitleHTML('Read [[file:notes.org][the plan]] and [[https://example.com][<site>]]', 'Tasks.org');
  expect(html).toContain('>the plan</a>');
  expect(html).toContain('>&lt;site&gt;</a>');
  expect(html).toContain('data-link-source="Tasks.org"');
  expect(taskTitleHTML('[[javascript:alert(1)][unsafe]]', 'Tasks.org')).toBe('unsafe');
  expect(taskTitleHTML('<b>plain</b>', '')).toBe('&lt;b&gt;plain&lt;/b&gt;');
});
