import { test, expect } from 'bun:test';
import { decodeSettings, encodeSettings, validGroup, migrateSettings, SETTINGS_FILE, LEGACY_SETTINGS_FILE } from './workspace-settings.js';
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
test('settings migration preserves bytes and conditionally removes only the copied legacy revision', async () => {
  const source = encodeSettings({ version: 1, groups: { editor: { 'orbitalnote-hide-footer': 'true' } } }).replaceAll('\n', '\r\n');
  const calls = [], w = { id: 7, files: [{ path: LEGACY_SETTINGS_FILE }] };
  await migrateSettings(w, async (method, q) => { calls.push([method, q]); return { source, revision: 'old-revision' }; });
  expect(calls[1]).toEqual(['Save', { id: 7, path: SETTINGS_FILE, source, revision: '' }]);
  expect(calls[2]).toEqual(['Remove', { id: 7, path: LEGACY_SETTINGS_FILE, revision: 'old-revision' }]);
  expect(await migrateSettings({ ...w, files: [...w.files, { path: SETTINGS_FILE }] }, () => { throw Error('must not overwrite'); })).toBe(false);
  const raced = [];
  await expect(migrateSettings(w, async (method, q) => {
    raced.push(method); if (method === 'Save') throw Error('already exists'); return { source, revision: 'old' };
  })).rejects.toThrow('already exists');
  expect(raced).toEqual(['Read', 'Save']);
});
