import { test, expect } from 'bun:test';
import { decodeSettings, encodeSettings, validGroup } from './workspace-settings.js';
test('settings envelope is versioned and does not interpret Org content', () => {
  const data = { version: 1, groups: { calendar: { colors: { work: '#abcdef' } } } };
  expect(decodeSettings(encodeSettings(data))).toEqual(data);
  expect(() => decodeSettings(encodeSettings({ version: 2, groups: {} }))).toThrow();
  expect(() => decodeSettings('ordinary notes')).toThrow();
});
test('only supported preferences and plain hex colors can be applied', () => {
  expect(validGroup('appearance', { 'org-theme': 'dark', 'org-theme-mode': 'light', css: 'body{}' })).toEqual({ 'org-theme': 'dark', 'org-theme-mode': 'light' });
  expect(validGroup('editor', { 'orbitalnote-hide-footer': 'false', command: 'execute' })).toEqual({ 'orbitalnote-hide-footer': 'false' });
  expect(validGroup('calendar', { colors: { work: '#abcdef', bad: 'url(https://example.com)' } })).toEqual({ colors: { work: '#abcdef' } });
});
