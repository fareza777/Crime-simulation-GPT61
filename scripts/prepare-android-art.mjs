import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const root='android/app/src/main/res';
const source='public/assets/icon.png';
for(const [density,size,foreground] of [['mdpi',48,108],['hdpi',72,162],['xhdpi',96,216],['xxhdpi',144,324],['xxxhdpi',192,432]]){
  const folder=path.join(root,`mipmap-${density}`);await fs.mkdir(folder,{recursive:true});
  for(const name of ['ic_launcher','ic_launcher_round'])await sharp(source).resize(size,size).png().toFile(path.join(folder,`${name}.png`));
  await sharp(source).resize(foreground,foreground).png().toFile(path.join(folder,'ic_launcher_foreground.png'));
}
for(const folder of ['drawable','mipmap-anydpi-v26','values'])await fs.mkdir(path.join(root,folder),{recursive:true});
await sharp(source).resize(288,288).png().toFile(path.join(root,'drawable','blackline_mark.png'));
const adaptive='<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>\n';
for(const file of ['ic_launcher.xml','ic_launcher_round.xml'])await fs.writeFile(path.join(root,'mipmap-anydpi-v26',file),adaptive);
await fs.writeFile(path.join(root,'values','ic_launcher_background.xml'),'<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#101213</color></resources>\n');
await fs.writeFile(path.join(root,'drawable','splash.xml'),'<?xml version="1.0" encoding="utf-8"?><layer-list xmlns:android="http://schemas.android.com/apk/res/android"><item><shape android:shape="rectangle"><solid android:color="#101213"/></shape></item><item><bitmap android:src="@drawable/blackline_mark" android:gravity="center"/></item></layer-list>\n');
for(const folder of await fs.readdir(root)){
  if(!folder.startsWith('drawable'))continue;
  const splash=path.resolve(root,folder,'splash.png');
  if(!splash.startsWith(path.resolve(root)+path.sep))throw new Error('Invalid drawable target');
  try{await fs.unlink(splash);}catch(error){if(error.code!=='ENOENT')throw error;}
}
console.log('BLACKLINE adaptive icons and native splash prepared.');
