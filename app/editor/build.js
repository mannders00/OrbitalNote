// The checked-in bundle keeps native builds independent of Node/Bun/npm.
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const result = await Bun.build({ entrypoints: ['source.js'], target: 'browser', minify: true });
if (!result.success) throw new AggregateError(result.logs, 'Editor bundle failed');
await Bun.write('../ui/vendor/editor.js', result.outputs[0]);
const notices = [];
for await (const path of new Bun.Glob('**/package.json').scan('node_modules')) {
  const root = join('node_modules', dirname(path));
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const license = (await readdir(root)).find(name => /^licen[cs]e(?:\.(?:md|txt))?$/i.test(name));
  if (license) notices.push(`${pkg.name} ${pkg.version}\n\n${await readFile(join(root, license), 'utf8')}`);
}
await Bun.write('../ui/vendor/LICENSES.txt', notices.sort().join('\n\n' + '-'.repeat(72) + '\n\n'));
