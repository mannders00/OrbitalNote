// Run app/dev with a disposable workspace; creates uniquely named test folders.
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
const base = process.env.BASE_URL || 'http://127.0.0.1:9277';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  const prefix = `files-${Date.now()}`;
  const chooseFolder = async path => {
    await page.locator('#modal .select-picker-trigger').click();
    await page.locator('#modal .select-picker-popup input').fill(path);
    await page.getByRole('option', { name: path, exact: true }).click();
  };
  const api = async (method, args = {}) => {
    const response = await page.request.post(base + '/api', { data: { method, ...args } });
    assert.ok(response.ok(), await response.text()); return response.json();
  };
  const { id } = await api('Status');
  await api('Mkdir', { id, path: prefix });
  await api('Mkdir', { id, path: `${prefix}/Nested` });
  await api('Save', { id, path: `${prefix}/Nested/Existing.org`, source: '* Existing\n', revision: '' });
  await page.reload();
  const folder = page.locator(`#tree details[data-path="${prefix}"]`);
  await folder.locator(':scope > summary').click();
  await folder.locator(':scope > summary [data-folder]').click();
  await page.getByRole('button', { name: 'New note…', exact: true }).click();
  assert.equal(await page.locator('#modal select').inputValue(), prefix);
  await page.locator('#modal input[name="name"]').fill('Meeting');
  assert.equal(await page.locator('#destination-path').textContent(), `${prefix}/Meeting.org`);
  await page.locator('#modal-submit').click();
  await page.locator(`#tree [data-open="${prefix}/Meeting.org"]`).waitFor();
  await page.locator('#new-folder').click();
  await page.locator('#modal input[name="name"]').fill('Subfolder');
  await chooseFolder(prefix);
  await page.locator('#modal-submit').click();
  await page.locator(`#tree details[data-path="${prefix}/Subfolder"]`).waitFor();
  await page.locator('#new-file').click();
  assert.equal(await page.locator('#modal select').inputValue(), prefix);
  await page.locator('#modal input[name="name"]').fill('Meeting.org');
  assert.equal(await page.locator('#modal input[name="name"]').evaluate(el => el.validity.valid), false);
  await page.locator('#modal-submit').click();
  assert.ok(await page.locator('#modal').isVisible());
  await page.locator('#modal input[name="name"]').fill('Second.org');
  await chooseFolder(`${prefix}/Nested`);
  await page.locator('#modal-submit').click();
  await page.locator(`#tree [data-open="${prefix}/Nested/Second.org"]`).waitFor();
  // Drop onto a file inside an expanded folder, not its summary row.
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  const moving = page.locator(`#tree [data-open="${prefix}/Meeting.org"]`);
  const target = page.locator(`#tree [data-open="${prefix}/Nested/Existing.org"]`);
  await moving.dispatchEvent('dragstart', { dataTransfer: transfer });
  await target.dispatchEvent('dragover', { dataTransfer: transfer });
  assert.equal(await page.locator('#tree .drop-target').getAttribute('data-path'), `${prefix}/Nested`);
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await page.locator(`#tree [data-open="${prefix}/Nested/Meeting.org"]`).waitFor();
  const moved = page.locator(`#tree [data-open="${prefix}/Nested/Meeting.org"]`);
  await moved.dispatchEvent('dragstart', { dataTransfer: transfer });
  await page.locator('#tree').dispatchEvent('dragover', { dataTransfer: transfer });
  assert.ok(await page.locator('#tree').evaluate(el => el.classList.contains('drop-target')));
  await moved.dispatchEvent('dragend', { dataTransfer: transfer });
  assert.equal(await page.locator('.drop-target').count(), 0);
  await folder.locator(':scope > summary').dispatchEvent('dragstart', { dataTransfer: transfer });
  await target.dispatchEvent('dragover', { dataTransfer: transfer });
  assert.equal(await page.locator('.drop-target').count(), 0, 'Cannot move a folder into a descendant');
  await folder.locator(':scope > summary').dispatchEvent('dragend', { dataTransfer: transfer });
  // Keyboard-accessible move prompt uses the same destination picker.
  await page.locator(`#tree [data-file-actions="${prefix}/Nested/Meeting.org"]`).click();
  await page.getByRole('button', { name: 'Rename or move…', exact: true }).click();
  assert.equal(await page.locator('#modal input[name="name"]').inputValue(), 'Meeting');
  await chooseFolder(prefix);
  await page.locator('#modal-submit').click();
  await page.locator(`#tree [data-open="${prefix}/Meeting.org"]`).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: folder-prefilled creation, automatic extension, duplicate validation, destination selection, whole-folder/nested drop targets, drag cleanup, and move picker.');
} finally { await browser.close(); }
