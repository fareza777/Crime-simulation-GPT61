import sharp from 'sharp';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const sources = JSON.parse(await fs.readFile(new URL('./art-sources.json', import.meta.url), 'utf8'));
const destination = new URL('../public/assets/', import.meta.url);
await fs.mkdir(destination, {recursive:true});
async function save(source, name, width=1200) {
  await sharp(source).resize({width, withoutEnlargement:true}).webp({quality:86}).toFile(fileURLToPath(new URL(name, destination)));
}
async function atlas(key, columns, rows, names, width) {
  const input=sources[key];
  const meta=await sharp(input).metadata();
  const cellWidth=Math.floor(meta.width/columns), cellHeight=Math.floor(meta.height/rows);
  for(let i=0;i<names.length;i++) {
    await sharp(input).extract({left:(i%columns)*cellWidth,top:Math.floor(i/columns)*cellHeight,width:cellWidth,height:cellHeight}).resize({width}).webp({quality:88}).toFile(fileURLToPath(new URL(names[i],destination)));
  }
}
await save(sources.city,'city.webp',1800);
await save(sources.warehouse,'warehouse.webp',1200);
await atlas('districts',3,2,['district-old-quarter.webp','district-portside.webp','district-the-strip.webp','district-ironworks.webp','district-crown-heights.webp','heist.webp'],900);
await atlas('crew',4,3,Array.from({length:11},(_,i)=>`crew-${i+1}.webp`).concat('player.webp'),400);
await atlas('businesses',3,2,Array.from({length:6},(_,i)=>`business-${i+1}.webp`),650);
await atlas('itemsA',4,4,Array.from({length:16},(_,i)=>`item-${i+1}.webp`),360);
await atlas('itemsB',4,4,Array.from({length:16},(_,i)=>`item-${i+17}.webp`),360);
await atlas('itemsC',4,2,Array.from({length:8},(_,i)=>`item-${i+33}.webp`),360);
for(const size of [192,512,1024]) await sharp(sources.icon).resize(size,size).png().toFile(fileURLToPath(new URL(size===1024?'icon.png':`icon-${size}.png`,destination)));
console.log('Prepared 69 original art assets in public/assets.');
