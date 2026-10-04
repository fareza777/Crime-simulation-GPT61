import {chromium,devices} from '@playwright/test';
import fs from 'node:fs/promises';
await fs.mkdir('output/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true});
for(const [label,options] of [['desktop',{viewport:{width:1440,height:1000}}],['mobile',{...devices['Pixel 7'],viewport:{width:393,height:851}}]]){
  const context=await browser.newContext(options);
  const page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')console.log(label,'console error:',m.text());});
  page.on('pageerror',e=>console.log(label,'PAGE ERROR:',e.stack));
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button',{name:'New game',exact:true}).waitFor({timeout:15000});
  await page.screenshot({path:`output/screenshots/${label}-menu.png`});
  await page.getByRole('button',{name:'New game',exact:true}).click();
  await page.getByRole('button',{name:'Skip introduction'}).click();
  await page.screenshot({path:`output/screenshots/${label}-character-creation.png`});
  await page.getByRole('button',{name:'Enter Blackwater'}).click();
  await page.getByRole('button',{name:'Plan operation',exact:true}).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({path:`output/screenshots/${label}-overview.png`,fullPage:true});
  console.log(label,JSON.stringify(await page.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth}))));
  await page.getByRole('button',{name:'Plan operation',exact:true}).click();
  await page.waitForTimeout(250);
  await page.screenshot({path:`output/screenshots/${label}-decision.png`});
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  if(await page.getByRole('button',{name:'Continue',exact:true}).isVisible())await page.getByRole('button',{name:'Continue',exact:true}).click();
  for(const screen of ['Crew','City','Operations','Empire']){
    await page.getByRole('button',{name:screen,exact:true}).last().click();
    await page.waitForTimeout(250);
    await page.screenshot({path:`output/screenshots/${label}-${screen.toLowerCase()}.png`,fullPage:true});
  }
  await context.close();
}
await browser.close();
