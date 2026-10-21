import { test, expect } from 'bun:test';
import { taskInsertion } from './task-destination.js';

test('prepend and append respect nesting and retain parent metadata and child subtrees', () => {
  for (const eol of ['\n', '\r\n']) {
    const source = ['#+TITLE: Tasks', '* Parent', ':PROPERTIES:', ':ID: parent', ':END:', 'Parent prose', '** First', 'Child prose', '*** Grandchild', '** Last', '* Sibling', ''].join(eol);
    const headings = [{ line: 2, level: 1 }, { line: 7, level: 2 }, { line: 9, level: 3 }, { line: 10, level: 2 }, { line: 11, level: 1 }];
    expect(taskInsertion(source, headings, '2', 'prepend')).toEqual({ at: source.indexOf('** First'), level: 2 });
    expect(taskInsertion(source, headings, '2', 'append')).toEqual({ at: source.indexOf('* Sibling'), level: 2 });
    expect(taskInsertion(source, headings, '7', 'append')).toEqual({ at: source.indexOf('** Last'), level: 3 });
    expect(taskInsertion(source, headings, '10', 'prepend')).toEqual({ at: source.indexOf('* Sibling'), level: 3 });
    expect(taskInsertion(source, headings, '', 'prepend')).toEqual({ at: source.indexOf('* Parent'), level: 1 });
    expect(taskInsertion(source, headings, '', 'append')).toEqual({ at: source.length, level: 1 });
  }
  expect(taskInsertion('', [], '', 'prepend')).toEqual({ at: 0, level: 1 });
  expect(() => taskInsertion('', [], '3')).toThrow('no longer exists');
});
