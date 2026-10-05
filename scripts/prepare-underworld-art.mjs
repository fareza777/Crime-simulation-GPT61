import sharp from 'sharp';
import fs from 'node:fs/promises';

await fs.mkdir('public/assets', { recursive: true });
for (const name of ['map', 'conflict', 'operation']) {
  const source = `art/source/underworld-${name}.png`;
  const target = `public/assets/underworld-${name}.webp`;
  await sharp(source).resize({ width: name === 'map' ? 1400 : 1100, withoutEnlargement: true }).webp({ quality: 86 }).toFile(target);
  console.log(target);
}
