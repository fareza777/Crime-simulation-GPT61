import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const output = 'output/playstore';
const publicRoot = 'promotional-video/public';
for (const directory of [output, `${output}/screenshots`, `${output}/android-launcher`, `${publicRoot}/art`, `${publicRoot}/game`, `${publicRoot}/fonts`, `${publicRoot}/audio`]) await fs.mkdir(directory, { recursive: true });

// Keep the generated originals; derived files only change size, encoding and color space.
for (const size of [512, 1024]) {
  await sharp(`${output}/source/blackline-icon.png`).resize(size, size).toColourspace('srgb').ensureAlpha().png({ compressionLevel: 9 }).toFile(`${output}/app-icon-${size}.png`);
}
await fs.copyFile(`${output}/app-icon-1024.png`, `${publicRoot}/art/icon.png`);
for (const name of ['city', 'vault']) await sharp(`${output}/source/blackline-${name}.png`).toColourspace('srgb').webp({ quality: 94 }).toFile(`${publicRoot}/art/${name}.webp`);
for (const [source, target] of [['crew-1', 'ghost'], ['crew-2', 'mace'], ['crew-3', 'drift'], ['underworld-map', 'map'], ['underworld-conflict', 'conflict'], ['underworld-operation', 'operation'], ['warehouse', 'warehouse']]) await fs.copyFile(`public/assets/${source}.webp`, `${publicRoot}/art/${target}.webp`);

for (const [packageName, family] of [['@fontsource-variable/oswald', 'Oswald'], ['@fontsource-variable/outfit', 'Outfit']]) {
  const directory = `node_modules/${packageName}/files`;
  const name = (await fs.readdir(directory)).find(file => file.endsWith('latin-wght-normal.woff2'));
  if (!name) throw new Error(`${family} local font is missing`);
  await fs.copyFile(path.join(directory, name), `${publicRoot}/fonts/${family}.woff2`);
}

// An Android resource pack accompanies the Play icon without overwriting the current game.
for (const [density, size, foreground] of [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]) {
  const directory = `${output}/android-launcher/mipmap-${density}`;
  await fs.mkdir(directory, { recursive: true });
  await sharp(`${output}/app-icon-1024.png`).resize(size, size).png().toFile(`${directory}/ic_launcher.png`);
  await sharp(`${output}/app-icon-1024.png`).resize(Math.round(foreground * .66), Math.round(foreground * .66)).extend({ top: Math.floor(foreground * .17), bottom: foreground - Math.round(foreground * .66) - Math.floor(foreground * .17), left: Math.floor(foreground * .17), right: foreground - Math.round(foreground * .66) - Math.floor(foreground * .17), background: '#101213' }).png().toFile(`${directory}/ic_launcher_foreground.png`);
}
await fs.mkdir(`${output}/android-launcher/mipmap-anydpi-v26`, { recursive: true });
await fs.mkdir(`${output}/android-launcher/values`, { recursive: true });
await fs.writeFile(`${output}/android-launcher/mipmap-anydpi-v26/ic_launcher.xml`, '<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/blackline_vault_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>\n');
await fs.writeFile(`${output}/android-launcher/values/blackline_vault_background.xml`, '<?xml version="1.0" encoding="utf-8"?><resources><color name="blackline_vault_background">#101213</color></resources>\n');
console.log('Play icon, original key art, offline fonts and Android icon resource pack prepared.');
