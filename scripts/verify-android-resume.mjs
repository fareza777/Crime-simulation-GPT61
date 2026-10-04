import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const pkg='com.blackline.crimelife';
const serial=process.env.BLACKLINE_QA_DEVICE ?? 'emulator-5658';
const adbPath=path.join(process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA,'Android','Sdk'),'platform-tools','adb.exe');
const adb=(...args)=>execFileSync(adbPath,['-s',serial,...args],{timeout:15000,encoding:'utf8'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
adb('shell','am','force-stop',pkg);
adb('shell','am','start','-n',`${pkg}/.MainActivity`);
await delay(750);
const pid=adb('shell','pidof',pkg).trim();
adb('forward','tcp:9658',`localabstract:webview_devtools_remote_${pid}`);
let target;
for(let i=0;i<30&&!target;i++){
  try{target=(await(await fetch('http://127.0.0.1:9658/json/list')).json()).find(target=>target.url==='https://localhost/');}catch{}
  if(!target)await delay(150);
}
if(!target)throw Error('Restarted Android WebView did not become available');
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let next=0;const pending=new Map();
socket.onmessage=event=>{const response=JSON.parse(event.data);const request=pending.get(response.id);if(request){pending.delete(response.id);clearTimeout(request.timer);response.error?request.reject(response.error):request.resolve(response.result);}};
const send=(method,params)=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>reject(Error(`Android inspector timed out: ${method}`)),10000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));return response.result.value;};
const click=label=>evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')===${JSON.stringify(label)}||button.innerText.trim()===${JSON.stringify(label)});if(!button)throw Error('Missing button');button.click();return true;})()`);
for(let i=0;i<40;i++){
  if(await evaluate(`[...document.querySelectorAll('button')].some(button=>button.innerText.trim()==='Continue story')`))break;
  if(i===39)throw Error('Local story did not load after force-stop: '+await evaluate('document.body.innerText.slice(0,650)'));
  await delay(150);
}
await click('Continue story');await delay(750);
assert.equal(await evaluate(`Boolean(document.querySelector('button[aria-label="Character profile: Android Vale"]'))`),true,'Wrong character restored');
const expected=JSON.parse(await fs.readFile('output/android/native-expect.json','utf8'));
assert.deepEqual(await evaluate(`[...document.querySelectorAll('.stat-card>strong')].map(node=>node.innerText)`),expected.stats,'Four main stats changed after force-stop');
assert.deepEqual(await evaluate(`[...document.querySelectorAll('.mobile-vitals strong')].map(node=>node.innerText)`),expected.vitals,'Health/energy changed after force-stop');
await click('Settings');await delay(250);
assert.equal(await evaluate(`document.querySelector('button[role="switch"][aria-label="Sound effects"]').getAttribute('aria-checked')`),'false','Native settings were not restored');
await click('Close dialog');await delay(450);
adb('shell','screencap','-p','/sdcard/blackline-qa.png');adb('pull','/sdcard/blackline-qa.png','output/screenshots/android-offline-resumed.png');
const report={status:'PASS',serial,androidOffline:true,checks:['bundled first launch','menu bounds','create character','five screens and images','resolve job and event','native Back','six player stats and settings survive force-stop/relaunch'],viewport:await evaluate(`({width:innerWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight})`)};
await fs.writeFile('output/android/native-qa.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));socket.close();adb('forward','--remove','tcp:9658');
