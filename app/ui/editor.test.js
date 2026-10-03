import { test, expect } from 'bun:test';
import { updateRaw, updateRawChanges } from './editor.js';

test('editing preserves mixed newlines and Unicode in untouched source', () => {
  const raw = '* TODO Café 📝\r\n#+UNKNOWN: opaque\n\r\nBody\rTail';
  const display = raw.replace(/\r\n?/g, '\n');
  const edited = display.replace('TODO', 'DONE');
  expect(updateRaw(raw, display, edited, '\n')).toBe(raw.replace('TODO', 'DONE'));
  expect(updateRaw(raw, display, display + '\nMore', '\r\n')).toBe(raw + '\r\nMore');
  expect(updateRaw(raw, display, display.replace('Body\n', ''), '\n')).toBe(raw.replace('Body\r', ''));
});

test('replacing or deleting the full buffer handles trailing newlines', () => {
  expect(updateRaw('a\r\nb\r\n', 'a\nb\n', '', '\r\n')).toBe('');
  expect(updateRaw('', '', '* New\nBody\n', '\r\n')).toBe('* New\r\nBody\r\n');
});

test('replace-all preserves mixed line endings and opaque source between matches', () => {
  const raw = 'cat 📝\r\n#+UNKNOWN: opaque\n:RAW: x\rcat\r\n';
  const normalized = raw.replace(/\r\n?/g, '\n');
  const second = normalized.lastIndexOf('cat');
  const changes = [{ from: 0, to: 3, insert: 'kitten' }, { from: second, to: second + 3, insert: 'dog\nfriend' }];
  expect(updateRawChanges(raw, changes, '\n')).toBe('kitten 📝\r\n#+UNKNOWN: opaque\n:RAW: x\rdog\nfriend\r\n');
});

test('multi-range insertions and deletions use original transaction offsets', () => {
  expect(updateRawChanges('a\r\nb\nc', [{ from: 0, to: 0, insert: '>' }, { from: 2, to: 4, insert: '' }, { from: 5, to: 5, insert: '\n' }], '\r\n')).toBe('>a\r\nc\r\n');
});
