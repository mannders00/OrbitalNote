import { test, expect } from 'bun:test';
import { updateRaw } from './editor.js';

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
