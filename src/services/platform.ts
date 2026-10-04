import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';

export const appInfo = Object.freeze({
  name: 'BLACKLINE', version: '1.0.0', appId: 'com.blackline.crimelife',
  // Set only after the matching public store listing exists.
  playUrl: null as string | null,
});

type SoundKind = 'tap' | 'success' | 'failure' | 'cash' | 'navigate';
interface AudioGraph {
  source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; released: boolean;
}

let context: AudioContext | null = null;
let ambientWanted = false;
let ambient: AudioGraph | null = null;
let fadingAmbient: AudioGraph | null = null;
let ambientGeneration = 0;
let unlocking = false;
let suspendTimer: ReturnType<typeof setTimeout> | null = null;
const graphs = new Set<AudioGraph>();
const buffers = new Map<string, AudioBuffer>();

function cancelSuspend(): void {
  if (suspendTimer !== null) clearTimeout(suspendTimer);
  suspendTimer = null;
}

function getAudio(): AudioContext | null {
  if (context && context.state !== 'closed') return context;
  const browser = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Audio = browser.AudioContext ?? browser.webkitAudioContext;
  if (!Audio) return null;
  try { context = new Audio(); return context; } catch { return null; }
}

function release(graph: AudioGraph): void {
  if (graph.released) return;
  graph.released = true;
  graph.source.disconnect();
  graph.filter.disconnect();
  graph.gain.disconnect();
  graphs.delete(graph);
  if (fadingAmbient === graph) fadingAmbient = null;
}

function makeGraph(audio: AudioContext, buffer: AudioBuffer, frequency: number): AudioGraph {
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = frequency;
  filter.Q.value = 0.35;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  const graph = { source, filter, gain, released: false };
  graphs.add(graph);
  source.onended = () => release(graph);
  return graph;
}

const cueOptions: Record<SoundKind, { duration: number; volume: number; filter: number }> = {
  tap: { duration: 0.04, volume: 0.08, filter: 2600 },
  success: { duration: 0.13, volume: 0.065, filter: 3400 },
  failure: { duration: 0.16, volume: 0.08, filter: 850 },
  cash: { duration: 0.2, volume: 0.075, filter: 5100 },
  navigate: { duration: 0.08, volume: 0.045, filter: 1700 },
};

function cueBuffer(audio: AudioContext, kind: SoundKind): AudioBuffer {
  const cached = buffers.get(kind);
  if (cached) return cached;
  const { duration } = cueOptions[kind];
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
  const data = buffer.getChannelData(0);
  let softNoise = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    softNoise = softNoise * 0.72 + white * 0.28;
    const progress = i / data.length;
    const decay = kind === 'tap' ? Math.exp(-progress * 10) : (1 - progress) ** 1.8;
    // Random noise grains suggest coins shifting; there are no periodic or tonal sources.
    const grain = kind === 'cash' && (i % Math.floor(audio.sampleRate * 0.036)) / audio.sampleRate > 0.015 ? 0.15 : 1;
    const edge = Math.min(1, i / (audio.sampleRate * 0.002));
    data[i] = (kind === 'failure' ? softNoise : white * 0.55 + softNoise * 0.45) * decay * grain * edge;
  }
  buffers.set(kind, buffer);
  return buffer;
}

function rainBuffer(audio: AudioContext): AudioBuffer {
  const cached = buffers.get('city-rain');
  if (cached) return cached;
  const buffer = audio.createBuffer(1, audio.sampleRate * 6, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let wind = 0;
  let drops = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    wind = 0.993 * wind + 0.007 * white;
    if (Math.random() < 10 / audio.sampleRate) drops = 0.2 + Math.random() * 0.6;
    drops *= 0.992;
    data[i] = white * (0.15 + drops * 0.15) + wind * 2.8;
  }
  // Blend the loop boundary so the environmental bed has no repeating click.
  const edge = Math.floor(audio.sampleRate * 0.15);
  for (let i = 0; i < edge; i++) {
    const blend = i / edge;
    data[data.length - edge + i] = data[data.length - edge + i] * (1 - blend) + data[i] * blend;
  }
  buffers.set('city-rain', buffer);
  return buffer;
}

function removeUnlock(): void {
  if (!unlocking || typeof globalThis.removeEventListener !== 'function') return;
  globalThis.removeEventListener('pointerdown', unlockAudio);
  globalThis.removeEventListener('keydown', unlockAudio);
  unlocking = false;
}

function waitForGesture(): void {
  if (unlocking || typeof globalThis.addEventListener !== 'function') return;
  unlocking = true;
  globalThis.addEventListener('pointerdown', unlockAudio, { passive: true });
  globalThis.addEventListener('keydown', unlockAudio);
}

function beginAmbient(audio: AudioContext): void {
  if (!ambientWanted || ambient || context !== audio || audio.state !== 'running') return;
  cancelSuspend();
  if (fadingAmbient) {
    try { fadingAmbient.source.stop(); } catch { /* A scheduled source may already have ended. */ }
    release(fadingAmbient);
  }
  ambient = makeGraph(audio, rainBuffer(audio), 1400);
  ambient.source.loop = true;
  ambient.gain.gain.setValueAtTime(0, audio.currentTime);
  ambient.gain.gain.linearRampToValueAtTime(0.055, audio.currentTime + 1.2);
  ambient.source.start();
  removeUnlock();
}

function unlockAudio(): void {
  const audio = context;
  if (!audio) return;
  void audio.resume().then(() => {
    if (context === audio) beginAmbient(audio);
    if (audio.state === 'running') removeUnlock();
  }).catch(() => { /* Retry only on another real user gesture. */ });
}

/** Short mechanical clicks, paper swishes and coin rustles generated from noise only. */
export function playSound(kind: SoundKind, enabled: boolean): void {
  if (!enabled) return;
  const audio = getAudio();
  if (!audio || graphs.size >= 24) return;
  cancelSuspend();
  void audio.resume().then(() => beginAmbient(audio)).catch(() => {
    if (ambientWanted) waitForGesture();
  });
  const options = cueOptions[kind];
  const graph = makeGraph(audio, cueBuffer(audio, kind), options.filter);
  graph.gain.gain.setValueAtTime(options.volume, audio.currentTime);
  graph.gain.gain.linearRampToValueAtTime(0, audio.currentTime + options.duration);
  graph.source.start();
}

/** A quiet rain and wind bed. Call from a user gesture; browser autoplay rules remain respected. */
export function startAmbient(enabled: boolean): void {
  if (!enabled) { stopAmbient(); return; }
  ambientWanted = true;
  const audio = getAudio();
  if (!audio || ambient) return;
  cancelSuspend();
  if (audio.state === 'running') { beginAmbient(audio); return; }
  const generation = ambientGeneration;
  waitForGesture();
  void audio.resume().then(() => {
    if (generation === ambientGeneration) beginAmbient(audio);
  }).catch(() => { /* Playback waits for the next user gesture. */ });
}

export function stopAmbient(): void {
  ambientWanted = false;
  ambientGeneration++;
  removeUnlock();
  if (ambient && context) {
    const graph = ambient;
    ambient = null;
    fadingAmbient = graph;
    const now = context.currentTime;
    graph.gain.gain.cancelScheduledValues(now);
    graph.gain.gain.setValueAtTime(graph.gain.gain.value, now);
    graph.gain.gain.linearRampToValueAtTime(0, now + 0.32);
    try { graph.source.stop(now + 0.34); } catch { release(graph); }
  }
  cancelSuspend();
  if (context) {
    suspendTimer = setTimeout(() => {
      suspendTimer = null;
      if (!ambientWanted && context?.state === 'running') void context.suspend().catch(() => undefined);
    }, 400);
  }
}

/** Releases all audio when the UI is disposed, without leaving hidden playback or loops. */
export async function disposeAudio(): Promise<void> {
  ambientWanted = false;
  ambientGeneration++;
  removeUnlock();
  cancelSuspend();
  for (const graph of graphs) {
    try { graph.source.stop(); } catch { /* Already ended. */ }
    release(graph);
  }
  ambient = fadingAmbient = null;
  buffers.clear();
  const previous = context;
  context = null;
  if (previous && previous.state !== 'closed') await previous.close();
}

export async function vibrate(enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12);
  } catch { /* Devices without haptics continue normally. */ }
}

function cancelled(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const detail = error as { name?: string; message?: string };
  return detail.name === 'AbortError' || /\b(?:cancelled|canceled|dismissed)\b/i.test(detail.message ?? '');
}

export async function shareGame(): Promise<'shared' | 'copied' | 'cancelled'> {
  const text = 'BLACKLINE — Rise through a living city. An offline crime life RPG.';
  const payload = { title: appInfo.name, text, ...(appInfo.playUrl ? { url: appInfo.playUrl } : {}) };
  try {
    if (Capacitor.isNativePlatform() && (await Share.canShare()).value) {
      await Share.share({ ...payload, dialogTitle: 'Share BLACKLINE' });
      return 'shared';
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function'
      && (typeof navigator.canShare !== 'function' || navigator.canShare(payload))) {
      await navigator.share(payload);
      return 'shared';
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(appInfo.playUrl ? `${text}\n${appInfo.playUrl}` : text);
      return 'copied';
    }
    throw new Error('Sharing is unavailable on this device.');
  } catch (error) {
    if (cancelled(error)) return 'cancelled';
    throw new Error('Could not share or copy the game message. Try again on a supported device.', { cause: error });
  }
}

export async function rateGame(): Promise<'opened' | 'unpublished'> {
  if (!appInfo.playUrl) return 'unpublished';
  if (typeof window === 'undefined') throw new Error('Could not open the store listing on this device.');
  const opened = window.open(appInfo.playUrl, Capacitor.isNativePlatform() ? '_system' : '_blank', 'noopener,noreferrer');
  if (!opened && !Capacitor.isNativePlatform()) throw new Error('Your browser blocked the store listing. Allow opening the store and try again.');
  return 'opened';
}

export async function initializePlatform(onBack: () => boolean): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  await SplashScreen.hide({ fadeOutDuration: 180 });
  if (Capacitor.getPlatform() !== 'android') return () => undefined;
  const listener = await App.addListener('backButton', () => {
    let handled = false;
    try { handled = onBack(); } catch (error) { console.warn('Could not handle back navigation.', error); }
    if (!handled) void App.minimizeApp().catch(error => { console.warn('Could not minimize BLACKLINE.', error); });
  });
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    void listener.remove().catch(error => { console.warn('Could not remove the back listener.', error); });
  };
}
