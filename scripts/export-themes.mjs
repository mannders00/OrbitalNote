import { mkdir, writeFile } from 'node:fs/promises';
import { themes } from '../app/ui/appearance.js';
import { themeCSS } from '../app/ui/theme-presets.js';
await mkdir('examples/Themes', { recursive: true });
for (const theme of themes) {
  await writeFile(`examples/Themes/${theme[1].toLowerCase().replaceAll(' ', '-')}.orbitalnote.css`, themeCSS(theme));
}
console.log(`Exported ${themes.length} self-contained CSS themes.`);
