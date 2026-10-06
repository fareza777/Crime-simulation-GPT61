import fs from 'node:fs/promises';

const sampleRate = 48000;
let seed = 0x61b1ac;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296 * 2 - 1; }
const directory = 'promotional-video/public/audio';
await fs.mkdir(directory, { recursive: true });
const report = [];
async function write(name, seconds, sample) {
  const length = Math.round(seconds * sampleRate);
  const data = Buffer.alloc(length * 4);
  let peak = 0, energy = 0;
  for (let index = 0; index < length; index++) {
    const values = sample(index / sampleRate, index);
    for (let channel = 0; channel < 2; channel++) {
      const value = Math.max(-.9, Math.min(.9, values[channel]));
      peak = Math.max(peak, Math.abs(value)); energy += value * value;
      data.writeInt16LE(Math.round(value * 32767), (index * 2 + channel) * 2);
    }
  }
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(data.length + 36, 4); header.write('WAVE', 8); header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  await fs.writeFile(`${directory}/${name}.wav`, Buffer.concat([header, data]));
  report.push({ name, seconds, sampleRate, channels: 2, peak, rms: Math.sqrt(energy / (length * 2)), source: 'original deterministic broadband noise and physical-style filtering; no notes, instruments, melody or musical rhythm' });
}

let windL = 0, windR = 0, rainL = 0, rainR = 0, rumble = 0;
await write('rain-city', 36, (time) => {
  const left = random(), right = random();
  windL += .007 * (left - windL); windR += .007 * (right - windR);
  rainL += .37 * (left - rainL); rainR += .37 * (right - rainR);
  rumble += .0012 * (random() - rumble);
  const envelope = Math.min(1, time / .7, (36 - time) / 1.6);
  return [(rainL * .095 + windL * .25 + rumble * .35) * envelope, (rainR * .095 + windR * .25 + rumble * .35) * envelope];
});
let paper = 0;
await write('paper', .48, time => { paper += .24 * (random() - paper); const envelope = Math.max(0, 1 - time / .48) * Math.min(1, time / .035); return [paper * .58 * envelope, paper * .49 * envelope]; });
let latch = 0;
await write('latch', .32, time => { const noise = random(); latch += .09 * (noise - latch); const value = (noise * .5 + latch * .7) * Math.exp(-time * 29); return [value, value * .85]; });
let air = 0;
await write('air', .8, time => { air += .08 * (random() - air); const envelope = Math.min(1, time / .18) * Math.max(0, (0.8 - time) / .5); return [air * .78 * envelope, air * .61 * envelope]; });
let door = 0, mechanical = 0;
await write('vault-door', 2.4, time => { const noise = random(); door += .012 * (noise - door); mechanical += .25 * (noise - mechanical); const slide = Math.min(1, time / .2) * Math.max(0, 1 - time / 2.4); const lock = time > .9 ? Math.exp(-(time - .9) * 32) : 0; return [(door * 1.8 + mechanical * .24) * slide + noise * .35 * lock, (door * 1.65 + mechanical * .18) * slide + noise * .29 * lock]; });
const clicks = [0, .043, .112, .208, .337, .455];
await write('keys', .7, time => { const envelope = clicks.reduce((sum, start) => sum + (time >= start ? Math.exp(-(time - start) * 155) : 0), 0); const value = random() * .38 * envelope; return [value, value * .87]; });
await fs.writeFile('output/playstore/audio-provenance.json', JSON.stringify({ music: false, vocals: false, instruments: false, files: report }, null, 2) + '\n');
console.log('Original stereo rain, air, paper, key clicks and vault mechanisms generated. No music or instruments.');
