import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const iconFiles = [
  'app/ui/mark.svg', 'scripts/render-brand.mjs', 'scripts/render-android-icons.mjs',
  'app/build/icon.png', 'app/build/icon-ios.png',
  'app/build/android/res/drawable-nodpi/ic_launcher_background.png',
  'app/build/android/res/drawable-nodpi/ic_launcher_foreground.png',
  ...['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].map(density => `app/build/android/res/mipmap-${density}/ic_launcher.png`),
];
export async function iconManifest() {
  return Object.fromEntries(await Promise.all(iconFiles.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
}
