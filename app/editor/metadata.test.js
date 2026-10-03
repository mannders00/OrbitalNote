import { test, expect } from 'bun:test';
import { metadataRanges } from './metadata.js';

test('fold drawers and standalone repeat history independently of heading bodies', () => {
  const source = '* TODO Bills\nDEADLINE: <2026-11-01 Sun +1m>\n:PROPERTIES:\n:LAST_REPEAT: [2026-10-03 Sat 10:18]\n:END:\n- State "DONE" from "TODO" [2026-10-03 Sat 10:18] ; occurrence DEADLINE: [2026-10-01 Thu]\n- State "DONE" from "TODO" [2026-09-04 Fri 14:42]\n- Ordinary list item\n:LOGBOOK:\nCLOCK: [2026-10-03 Sat 10:04]--[2026-10-03 Sat 10:14] => 0:10\n:END:\nBody remains visible.\n** Child\n:PROPERTIES:\n:ID: child\n:END:\n';
  const ranges = metadataRanges(source);
  expect(ranges.map(r => r.label)).toEqual(['PROPERTIES', 'HISTORY', 'LOGBOOK', 'PROPERTIES']);
  expect(ranges.slice(0, 3).every(r => r.headingStart === 0)).toBe(true);
  expect(ranges[3].headingStart).toBe(source.indexOf('** Child'));
  for (const range of ranges) expect(source.slice(range.from, range.to)).not.toMatch(/DEADLINE: <|Ordinary list item|Body remains visible/);
  expect(source.slice(ranges[1].from, ranges[1].to).split('\n')).toHaveLength(2);
});

test('drawer examples in source blocks and unterminated drawers do not hide notes', () => {
  const source = '#+begin_src org\n:PROPERTIES:\n:ID: example\n:END:\n- State "DONE" from "TODO" [2026-10-03 Sat]\n#+end_src\n* One\n:LOGBOOK:\nSome body\n* Two\nBody\n:PROPERTIES:\n:ID: unfinished';
  expect(metadataRanges(source)).toEqual([]);
});

test('custom and file drawers, single history lines, and CRLF retain precise offsets', () => {
  const source = ':PROPERTIES:\r\n:OWNER: me\r\n:END:\r\n* Task\r\n:CUSTOM:\r\nopaque value\r\n:END:\r\nCLOCK: [2026-10-03 Sat 10:04]\r\nBody';
  const ranges = metadataRanges(source);
  expect(ranges.map(r => [r.label, r.headingStart])).toEqual([['PROPERTIES', -1], ['CUSTOM', source.indexOf('* Task')], ['CLOCK HISTORY', source.indexOf('* Task')]]);
  expect(source.slice(ranges[0].from, ranges[0].to)).toBe(':PROPERTIES:\r\n:OWNER: me\r\n:END:');
  expect(source.slice(ranges[2].from, ranges[2].to)).toBe('CLOCK: [2026-10-03 Sat 10:04]');
});
