import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'output/playstore');
const require = createRequire(path.join(root, 'promotional-video/package.json'));
const { RenderInternals } = require('@remotion/renderer');
const binary = type => RenderInternals.getExecutablePath({ type, indent: false, logLevel: 'error', binariesDirectory: null });
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const screenshots = [
  { file: '01-rise.png', title: 'Your rise. Your rules.', alt: 'BLACKLINE dashboard showing cash, reputation, Heat, influence, health, energy and a warehouse opportunity.' },
  { file: '02-decisions.png', title: 'Every choice leaves a mark.', alt: 'Warehouse decision with reward range, energy, Heat, preparation costs and three different success chances.' },
  { file: '03-territory.png', title: 'Take the city. Zone by zone.', alt: 'Blackwater map with 15 territory zones, ownership, connected supply routes and actions against rivals.' },
  { file: '04-crew.png', title: 'Loyalty is never guaranteed.', alt: 'Fully masked crew specialists Ghost and Mace with loyalty, fatigue, salaries and profile actions.' },
  { file: '05-businesses.png', title: 'Build income. Balance power.', alt: 'Business management showing daily income, crew payroll, net profit and the illustrated Corner Cafe venture.' },
  { file: '06-rivals.png', title: 'Outthink your rivals.', alt: 'Turn-based territory battle with momentum, morale, exposure and choices to advance, find an opening or protect crew.' },
  { file: '07-heist.png', title: 'Plan the score. Own the escape.', alt: 'Harbor Ledger operation planning with preparation cost, reward range, masked crew selection and required equipment.' },
  { file: '08-story.png', title: 'Your story. Your legacy.', alt: 'Main story journal showing the Meridian heist objective, quest rewards and later territory progression.' },
];
for (const item of screenshots) assert.ok(item.alt.length <= 140, 'Alt text exceeds Play Console guidance.');
for (const dir of ['docs', 'fonts', 'licenses']) await fs.mkdir(path.join(output, dir), { recursive: true });
await fs.copyFile(path.join(root, 'docs/playstore-campaign.md'), path.join(output, 'docs/campaign.md'));
for (const file of ['playstore-art-prompts.json', 'art-prompts.json', 'underworld-art-prompts.json']) await fs.copyFile(path.join(root, 'docs', file), path.join(output, 'docs', file));
for (const [family, packageName] of [['Oswald', 'oswald'], ['Outfit', 'outfit']]) {
  await fs.copyFile(path.join(root, `promotional-video/public/fonts/${family}.woff2`), path.join(output, `fonts/${family}.woff2`));
  await fs.copyFile(path.join(root, `node_modules/@fontsource-variable/${packageName}/LICENSE`), path.join(output, `licenses/${family}-OFL.txt`));
}
await fs.writeFile(path.join(output, 'alt-text.json'), JSON.stringify({ language: 'en-US', icon: 'Champagne gold BLACKLINE vault monogram with a keyhole on textured charcoal. No person or face.', featureGraphic: 'BLACKLINE crime life RPG title and Every choice leaves a mark over an illustrated rainy port city.', screenshots }, null, 2));
await fs.writeFile(path.join(output, 'youtube-description.txt'), `BLACKLINE — Every choice leaves a mark.\n\nOne wrong move. Everything changes.\n\nBuild your rise through illustrated decisions, calculated risk and an empire that has to pay its own bills. Recruit a masked crew, manage businesses, compete with rival organizations and plan multi-stage operations.\n\nFive districts. Fifteen zones. Eleven recruitable specialists. Thirty crime activities. A branching main story and side quests.\n\nA portrait crime life RPG that plays offline. This trailer shows actual gameplay from an advanced demonstration profile.\n\nOriginal rain ambience and mechanical sound effects. No music, instruments or voices.\n`);
await fs.writeFile(path.join(output, 'README.txt'), `BLACKLINE — EVERY CHOICE LEAVES A MARK.\n\nPLAY STORE UPLOAD FILES\napp-icon-512.png — 512 × 512 RGBA PNG\nfeature-graphic-1024x500.png — 1024 × 500 RGB PNG\nscreenshots/ — eight numbered 1080 × 1920 portrait RGB PNGs\n\nVIDEO\nBLACKLINE-PlayStore-Portrait-1080x1920.mp4 — 36 seconds, 30 fps, H.264/AAC\nBLACKLINE-Cinematic-Landscape-1920x1080.mp4 — alternate landscape edit\ntrailer-thumbnail-1920x1080.png — English hook thumbnail\nyoutube-description.txt — suggested English title and description\n\nUpload a trailer to YouTube as public or unlisted, allow embedding, disable monetization/ads and avoid age restrictions. Paste its YouTube URL into Play Console. The MP4 itself is not uploaded to Play Console.\n\nREVIEW\nOpen gallery.html locally. It works offline. Click a screenshot to view its full resolution.\nalt-text.json contains English accessibility descriptions.\nasset-validation.json records file dimensions, formats, checksums, encoded video frames and decoded audio levels.\n\nEXTRAS\napp-icon-1024.png is the high-resolution master.\nandroid-launcher/ contains five Android icon densities and an adaptive vault icon for a future app release.\ndocs/campaign.md explains the artwork, edit and upload sequence.\nThe editable Remotion source is in promotional-video/ in the GitHub repository.\n\nAll copy is English. All portraits are covered. The icon has no human face. The sound design uses rain and mechanical effects only, with no instruments, music or voices.\n`);

const cards = screenshots.map(item => `<a class="screen" href="screenshots/${item.file}" target="_blank" rel="noopener"><img src="screenshots/${item.file}" width="1080" height="1920" alt="${item.alt}" loading="lazy"><span>${item.title}</span></a>`).join('\n');
await fs.writeFile(path.join(output, 'gallery.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BLACKLINE — Store Collection</title><style>
@font-face{font-family:Outfit;src:url('fonts/Outfit.woff2')}@font-face{font-family:Oswald;src:url('fonts/Oswald.woff2')}
*{box-sizing:border-box}html{background:#0b0d0f;color:#ede5d8;font-family:Outfit,Arial,sans-serif}body{margin:0}main{max-width:1240px;margin:auto;padding:48px 28px 70px}header{display:flex;align-items:center;gap:23px;padding-bottom:28px;border-bottom:1px solid #b7996b33}header img{width:86px;height:86px}h1{font:550 52px/1 Oswald;margin:0 0 10px}p{color:#b9ae9c;font-size:18px;line-height:1.55;margin:8px 0}h2{font:500 35px Oswald;margin:0 0 12px}a{color:#dfc397;text-decoration:none}a:hover{color:#fff}section{margin-top:42px}.hero{display:grid;grid-template-columns:1fr 1fr;gap:36px}.banner{width:100%;height:auto;margin:17px 0;border:1px solid #b7996b55}button{font:500 17px Outfit;padding:12px 17px;border:1px solid #a98c5e55;background:#16191b;color:#c8bca9;cursor:pointer}button[aria-pressed=true]{background:#d4b58a;color:#141210}button:focus-visible,a:focus-visible{outline:3px solid #e0c398;outline-offset:4px}.video-box{display:flex;justify-content:center;margin-top:16px;background:#090b0d;border:1px solid #a98c5e55;padding:16px;min-height:430px}.video-box video{max-width:100%;width:270px;max-height:590px;background:#090b0d}.video-box.landscape video{width:100%;max-height:none}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}.screen{display:block}.screen img{display:block;width:100%;height:auto;border:1px solid #a98c5e44;transition:border-color .2s}.screen:hover img{border-color:#e0c398}.screen span{display:block;margin-top:10px;font-size:17px;line-height:1.4}.links{display:flex;gap:24px;flex-wrap:wrap;font-size:18px;margin-top:22px}footer{margin-top:40px;border-top:1px solid #b7996b33;padding-top:23px;color:#a69a87;font-size:16px}@media(max-width:800px){main{padding:28px 20px 48px}.hero{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,1fr);gap:18px}h1{font-size:42px}header img{width:70px;height:70px}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body><main>
<header><img src="app-icon-512.png" alt="Gold vault monogram without a person or face"><div><h1>BLACKLINE.</h1><p>Every choice leaves a mark.</p></div></header>
<div class="hero"><section><h2>The store collection.</h2><p>English artwork. Real gameplay. Charcoal and champagne gold.</p><a href="feature-graphic-1024x500.png" target="_blank" rel="noopener"><img class="banner" src="feature-graphic-1024x500.png" width="1024" height="500" alt="BLACKLINE feature graphic showing a rainy city"></a><div class="links"><a href="app-icon-512.png" download>App icon</a><a href="feature-graphic-1024x500.png" download>Feature graphic</a><a href="BLACKLINE-PlayStore-Kit.zip" download>Complete ZIP</a></div><p style="margin-top:24px">Fully covered portraits. Original rain and mechanical SFX. No music or instruments.</p></section>
<section><h2>One wrong move.</h2><p>A 36-second gameplay trailer. Choose the format.</p><div role="group" aria-label="Trailer format"><button id="portrait" aria-pressed="true">Portrait · 9:16</button><button id="landscape" aria-pressed="false">Landscape · 16:9</button></div><div class="video-box" id="video-box"><video id="trailer" controls playsinline preload="metadata" poster="screenshots/02-decisions.png" src="BLACKLINE-PlayStore-Portrait-1080x1920.mp4" aria-label="BLACKLINE gameplay trailer"></video></div><div class="links"><a id="video-download" href="BLACKLINE-PlayStore-Portrait-1080x1920.mp4" download>Download this trailer</a><a href="trailer-thumbnail-1920x1080.png" download>Thumbnail</a></div></section></div>
<section><h2>Eight stories. One city.</h2><p>Open any screenshot at its full 1080 × 1920 resolution.</p><div class="grid">${cards}</div></section>
<footer>Upload assets, accessibility descriptions and launcher resources are included in the ZIP. Play Store preview videos use a YouTube URL. See <a href="docs/campaign.md">the handoff</a> and <a href="asset-validation.json">asset verification</a>.</footer>
</main><script>
const video=document.getElementById('trailer'),box=document.getElementById('video-box'),download=document.getElementById('video-download');
for(const format of ['portrait','landscape'])document.getElementById(format).addEventListener('click',()=>{video.pause();const wide=format==='landscape';video.src=wide?'BLACKLINE-Cinematic-Landscape-1920x1080.mp4':'BLACKLINE-PlayStore-Portrait-1080x1920.mp4';video.poster=wide?'trailer-thumbnail-1920x1080.png':'screenshots/02-decisions.png';box.classList.toggle('landscape',wide);download.href=video.src;for(const f of ['portrait','landscape'])document.getElementById(f).setAttribute('aria-pressed',String(f===format));video.load();});
</script></body></html>`);
if (process.argv.includes('--prepare')) { process.stdout.write('Offline gallery, handoff and accessibility files prepared.\n'); process.exit(0); }

const assets = [];
for (const [file, width, height, alpha] of [
  ['app-icon-512.png', 512, 512, true], ['app-icon-1024.png', 1024, 1024, true], ['feature-graphic-1024x500.png', 1024, 500, false], ['trailer-thumbnail-1920x1080.png', 1920, 1080, false],
  ...screenshots.map(item => [`screenshots/${item.file}`, 1080, 1920, false]),
]) {
  const bytes = await fs.readFile(path.join(output, file));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'png', file);
  assert.equal(metadata.width, width, file);
  assert.equal(metadata.height, height, file);
  assert.equal(metadata.hasAlpha, alpha, file);
  assert.equal(metadata.space, 'srgb', file);
  if (file === 'app-icon-512.png') assert.ok(bytes.length <= 1024 * 1024, 'Play icon exceeds 1 MiB.');
  assets.push({ file, width, height, channels: metadata.channels, hasAlpha: alpha, colorSpace: metadata.space, bytes: bytes.length, sha256: hash(bytes) });
}
const run = (executable, args, buffer = false) => {
  const result = spawnSync(executable, args, { shell: false, windowsHide: true, maxBuffer: 24 * 1024 * 1024, encoding: buffer ? null : 'utf8' });
  assert.equal(result.status, 0, result.stderr?.toString() || result.error?.message || 'Media tool failed.');
  return result.stdout;
};
const videos = [];
for (const [file, width, height] of [['BLACKLINE-PlayStore-Portrait-1080x1920.mp4', 1080, 1920], ['BLACKLINE-Cinematic-Landscape-1920x1080.mp4', 1920, 1080]]) {
  const filename = path.join(output, file);
  const probe = JSON.parse(run(binary('ffprobe'), ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', filename]));
  const video = probe.streams.find(stream => stream.codec_type === 'video');
  const audio = probe.streams.find(stream => stream.codec_type === 'audio');
  assert.equal(video.codec_name, 'h264');
  assert.equal(video.width, width); assert.equal(video.height, height);
  assert.equal(video.nb_frames, '1080'); assert.equal(video.avg_frame_rate, '30/1');
  assert.equal(Number(video.duration), 36);
  assert.ok(['yuv420p', 'yuvj420p'].includes(video.pix_fmt));
  assert.equal(audio.codec_name, 'aac'); assert.equal(audio.channels, 2); assert.equal(audio.sample_rate, '48000');
  const pcm = run(binary('ffmpeg'), ['-v', 'error', '-i', filename, '-vn', '-acodec', 'pcm_s16le', '-f', 'wav', 'pipe:1'], true);
  let start = 12;
  while (pcm.toString('ascii', start, start + 4) !== 'data') {
    const size = pcm.readUInt32LE(start + 4);
    start += 8 + size + size % 2;
    assert.ok(start + 8 <= pcm.length, 'Missing decoded WAV data.');
  }
  start += 8;
  let peak = 0, squares = 0, clipped = 0;
  for (let offset = start; offset + 1 < pcm.length; offset += 2) {
    const sample = pcm.readInt16LE(offset) / 32768;
    peak = Math.max(peak, Math.abs(sample)); squares += sample * sample;
    if (Math.abs(sample) >= .999) clipped++;
  }
  assert.equal(clipped, 0, 'Encoded audio clips.'); assert.ok(peak > .01, 'Encoded audio is silent.');
  const bytes = await fs.readFile(filename);
  videos.push({ file, width, height, durationSeconds: Number(video.duration), fps: 30, frames: 1080, codec: video.codec_name, pixelFormat: video.pix_fmt, audioCodec: audio.codec_name, sampleRate: 48000, channels: 2, peakDbFS: 20 * Math.log10(peak), meanDbFS: 10 * Math.log10(squares / ((pcm.length - start) / 2)), clippedSamples: clipped, bytes: bytes.length, sha256: hash(bytes) });
  // Inspect the encoded video, as well as the Remotion stills, at ten useful moments.
  const storyboardFrames = [];
  for (const seconds of [2, 3.35, 6, 10.3, 14.8, 19.3, 23.8, 27.9, 30.4, 34.8]) {
    const jpg = run(binary('ffmpeg'), ['-v', 'error', '-ss', String(seconds), '-i', filename, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1'], true);
    await fs.writeFile(path.join(output, `review/encoded-${width < height ? 'portrait' : 'landscape'}-${String(seconds).replace('.', '-')}.jpg`), jpg);
    storyboardFrames.push(jpg);
  }
  const columns = width < height ? 5 : 2;
  const thumbnailWidth = width < height ? 540 : 960;
  const thumbnailHeight = width < height ? 960 : 540;
  const tiles = await Promise.all(storyboardFrames.map(async (frame, index) => ({ input: await sharp(frame).resize(thumbnailWidth, thumbnailHeight).toBuffer(), left: index % columns * thumbnailWidth, top: Math.floor(index / columns) * thumbnailHeight })));
  await sharp({ create: { width: thumbnailWidth * columns, height: thumbnailHeight * Math.ceil(tiles.length / columns), channels: 3, background: '#0c0e10' } }).composite(tiles).jpeg({ quality: 95 }).toFile(path.join(output, `review/encoded-${width < height ? 'portrait' : 'landscape'}-storyboard.jpg`));
  process.stdout.write(`Verified ${file}: 1080 frames, stereo audio, no clipping.\n`);
}
const review = JSON.parse(await fs.readFile(path.join(output, 'game-review.json'), 'utf8'));
const audioSource = JSON.parse(await fs.readFile(path.join(output, 'audio-provenance.json'), 'utf8'));
assert.equal(audioSource.music, false); assert.equal(audioSource.instruments, false); assert.equal(audioSource.vocals, false);
await fs.writeFile(path.join(output, 'asset-validation.json'), JSON.stringify({ createdAt: new Date().toISOString(), language: 'en-US', assets, videos, screenshots: 8, iconHasHumans: false, fullFacesAllowed: false, music: false, instruments: false, vocals: false, gameplayCaptureReview: review, artPrompts: 'docs/playstore-art-prompts.json', renderSource: '../../promotional-video/src', visualReview: 'Source artwork, all eight screenshot layouts and ten key frames per video inspected. Encoded video frames also extracted for final inspection.' }, null, 2));

// A Windows handoff ZIP with explicit, verified workspace paths. No source files are removed.
assert.equal(process.platform, 'win32', 'Create the handoff ZIP with your platform archive utility outside Windows.');
const members = ['app-icon-512.png', 'app-icon-1024.png', 'feature-graphic-1024x500.png', 'trailer-thumbnail-1920x1080.png', 'contact-sheet.jpg', 'gallery.html', 'README.txt', 'youtube-description.txt', 'alt-text.json', 'asset-validation.json', 'audio-provenance.json', 'game-review.json', 'BLACKLINE-PlayStore-Portrait-1080x1920.mp4', 'BLACKLINE-Cinematic-Landscape-1920x1080.mp4', 'screenshots', 'android-launcher', 'fonts', 'licenses', 'docs'].map(name => path.resolve(output, name));
const archive = path.join(output, 'BLACKLINE-PlayStore-Kit.zip');
for (const member of [...members, archive]) assert.ok(member.startsWith(output + path.sep), 'Archive path escapes the intended delivery directory.');
const quote = value => `'${value.replaceAll("'", "''")}'`;
run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Compress-Archive -LiteralPath @(${members.map(quote).join(',')}) -DestinationPath ${quote(archive)} -CompressionLevel Optimal -Force`]);
const archived = await fs.stat(archive);
assert.ok(archived.size < 95 * 1024 * 1024, 'The ZIP exceeds the intended GitHub single-file size.');
process.stdout.write(`Play Store kit complete: ${assets.length} image assets, two verified videos, ${Math.round(archived.size / 1024 / 1024)} MiB ZIP.\n`);
