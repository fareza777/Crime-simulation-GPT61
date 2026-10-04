import fs from 'node:fs/promises';
import path from 'node:path';

const root=JSON.parse(await fs.readFile('package.json','utf8'));
const pending=[...Object.keys(root.dependencies),'workbox-core','workbox-routing','workbox-precaching','workbox-strategies','workbox-window'];
const visited=new Set();const notices=[];
while(pending.length){
  const name=pending.shift();if(visited.has(name))continue;visited.add(name);
  const folder=path.join('node_modules',name);
  let pkg;try{pkg=JSON.parse(await fs.readFile(path.join(folder,'package.json'),'utf8'));}catch{continue;}
  pending.push(...Object.keys(pkg.dependencies??{}));
  const files=await fs.readdir(folder);
  const file=files.find(file=>/^licen[cs]e(?:\.md|\.txt)?$/i.test(file));
  if(!file)continue;
  notices.push(`${name} ${pkg.version} (${pkg.license??'see license'})\n${await fs.readFile(path.join(folder,file),'utf8')}`);
}
await fs.mkdir('public/licenses',{recursive:true});
await fs.writeFile('public/licenses/THIRD-PARTY-NOTICES.txt',`BLACKLINE — bundled third-party software and font notices\n\n${notices.join('\n\n'+'='.repeat(72)+'\n\n')}`.trimEnd()+'\n');
console.log(`Bundled notices for ${notices.length} runtime packages and fonts.`);
