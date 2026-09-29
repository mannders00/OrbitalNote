// The checked-in bundle keeps native builds independent of Node/Bun/npm.
import { readFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const result = await Bun.build({ entrypoints: ['source.js'], target: 'browser', minify: true });
if (!result.success) throw new AggregateError(result.logs, 'Editor bundle failed');
await Bun.write('../ui/vendor/editor.js', result.outputs[0]);
const rich = await Bun.build({ entrypoints: ['rich.js'], target: 'browser', minify: true });
if (!rich.success) throw new AggregateError(rich.logs, 'Rich preview bundle failed');
await Bun.write('../ui/vendor/rich.js', rich.outputs.find(output => output.path.endsWith('.js')));
await copyFile('node_modules/katex/dist/katex.min.css', '../ui/vendor/katex.css');
await mkdir('../ui/vendor/fonts', { recursive: true });
for (const name of await readdir('node_modules/katex/dist/fonts')) {
  if (name.endsWith('.woff2')) await copyFile('node_modules/katex/dist/fonts/' + name, '../ui/vendor/fonts/' + name);
}
const notices = [];
for await (const path of new Bun.Glob('**/package.json').scan('node_modules')) {
  const root = join('node_modules', dirname(path));
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const license = (await readdir(root)).find(name => /^licen[cs]e(?:\.(?:md|txt))?$/i.test(name));
  if (license) notices.push(`${pkg.name} ${pkg.version}\n\n${await readFile(join(root, license), 'utf8')}`);
}
await Bun.write('../ui/vendor/LICENSES.txt', notices.sort().join('\n\n' + '-'.repeat(72) + '\n\n'));
