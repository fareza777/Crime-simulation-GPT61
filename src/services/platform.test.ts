import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  enabled: false,
  back: null as (() => void) | null,
  share: vi.fn().mockResolvedValue({ activityType: 'test-target' }),
  canShare: vi.fn().mockResolvedValue({ value: true }),
  impact: vi.fn().mockResolvedValue(undefined),
  hide: vi.fn().mockResolvedValue(undefined),
  minimize: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.enabled, getPlatform: () => native.enabled ? 'android' : 'web' } }));
vi.mock('@capacitor/share', () => ({ Share: { share: native.share, canShare: native.canShare } }));
vi.mock('@capacitor/haptics', () => ({ Haptics: { impact: native.impact }, ImpactStyle: { Light: 'LIGHT' } }));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: native.hide } }));
vi.mock('@capacitor/app', () => ({ App: {
  minimizeApp: native.minimize,
  addListener: async (_event: string, callback: () => void) => { native.back = callback; return { remove: native.remove }; },
} }));

import { disposeAudio, initializePlatform, playSound, rateGame, shareGame, startAmbient, stopAmbient, vibrate } from './platform';

class Parameter {
  value = 0;
  setValueAtTime(value: number, _time: number) { this.value = value; return this; }
  linearRampToValueAtTime(value: number, _time: number) { this.value = value; return this; }
  exponentialRampToValueAtTime(value: number, _time: number) { this.value = value; return this; }
  cancelScheduledValues(_time: number) { return this; }
}

class AudioNodeDouble {
  disconnected = false;
  connect(node: unknown) { return node; }
  disconnect() { this.disconnected = true; }
}

class Source extends AudioNodeDouble {
  buffer: { getChannelData(channel: number): Float32Array } | null = null;
  loop = false;
  started = false;
  stopped = false;
  onended: (() => void) | null = null;
  start(_time?: number) { this.started = true; }
  stop(_time?: number) { this.stopped = true; }
}

class AudioContextDouble {
  static instances: AudioContextDouble[] = [];
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new AudioNodeDouble();
  sources: Source[] = [];
  constructor() { AudioContextDouble.instances.push(this); }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
  createBuffer(_channels: number, length: number, _sampleRate: number) {
    const data = new Float32Array(length);
    return { getChannelData: (_channel: number) => data };
  }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  createGain() { return Object.assign(new AudioNodeDouble(), { gain: new Parameter() }); }
  createBiquadFilter() { return Object.assign(new AudioNodeDouble(), { type: '', frequency: new Parameter(), Q: new Parameter() }); }
}

beforeEach(() => {
  native.enabled = false;
  native.back = null;
  vi.clearAllMocks();
  native.share.mockResolvedValue({ activityType: 'test-target' });
  native.canShare.mockResolvedValue({ value: true });
  AudioContextDouble.instances = [];
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('AudioContext', AudioContextDouble);
});

afterEach(async () => {
  await disposeAudio();
  vi.unstubAllGlobals();
});

describe('sharing and release availability', () => {
  it('shares original game text through the native sheet', async () => {
    native.enabled = true;
    expect(await shareGame()).toBe('shared');
    const payload = native.share.mock.calls[0][0] as { title: string; text: string; url?: string };
    expect(payload.title).toBe('BLACKLINE');
    expect(payload.text).toContain('offline');
    expect(payload.url).toBeUndefined();
  });

  it('shares through a supported browser', async () => {
    let sharedText = '';
    vi.stubGlobal('navigator', { share: async (payload: { text: string }) => { sharedText = payload.text; } });
    expect(await shareGame()).toBe('shared');
    expect(sharedText).toContain('BLACKLINE');
  });

  it('treats browser cancellation as cancellation without copying', async () => {
    let copied = false;
    vi.stubGlobal('navigator', {
      share: async () => { throw new DOMException('Dismissed by user', 'AbortError'); },
      clipboard: { writeText: async () => { copied = true; } },
    });
    expect(await shareGame()).toBe('cancelled');
    expect(copied).toBe(false);
  });

  it('treats native cancellation as cancellation', async () => {
    native.enabled = true;
    native.share.mockRejectedValueOnce(new Error('Share canceled'));
    expect(await shareGame()).toBe('cancelled');
  });

  it('copies a short share message when the browser has no share sheet', async () => {
    let copiedText = '';
    vi.stubGlobal('navigator', { clipboard: { writeText: async (text: string) => { copiedText = text; } } });
    expect(await shareGame()).toBe('copied');
    expect(copiedText).toContain('BLACKLINE');
    expect(copiedText).not.toContain('play.google.com');
    expect(copiedText.length).toBeLessThan(250);
  });

  it('reports a clipboard failure instead of claiming the message was copied', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('denied'); } } });
    await expect(shareGame()).rejects.toThrow(/share|copy/i);
  });

  it('reports share unavailability', async () => {
    await expect(shareGame()).rejects.toThrow(/sharing|share|copy/i);
  });

  it('does not open an invented store listing before publication', async () => {
    let opened = false;
    vi.stubGlobal('window', { open: () => { opened = true; } });
    expect(await rateGame()).toBe('unpublished');
    expect(opened).toBe(false);
  });
});

describe('native app navigation and feedback', () => {
  it('lets the UI handle back navigation and minimizes when no UI consumes it', async () => {
    native.enabled = true;
    let handled = true;
    const cleanup = await initializePlatform(() => handled);
    expect(native.hide).toHaveBeenCalledOnce();
    native.back!();
    expect(native.minimize).not.toHaveBeenCalled();
    handled = false;
    native.back!();
    expect(native.minimize).toHaveBeenCalledOnce();
    cleanup();
    expect(native.remove).toHaveBeenCalledOnce();
  });

  it('does not attach native listeners in a browser', async () => {
    const cleanup = await initializePlatform(() => false);
    cleanup();
    expect(native.back).toBeNull();
    expect(native.hide).not.toHaveBeenCalled();
  });

  it('respects the haptics preference', async () => {
    native.enabled = true;
    await vibrate(false);
    expect(native.impact).not.toHaveBeenCalled();
    await vibrate(true);
    expect(native.impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });
});

describe('nonmusical audio', () => {
  it('never starts audio when sound and city ambience are disabled', () => {
    playSound('tap', false);
    startAmbient(false);
    expect(AudioContextDouble.instances).toHaveLength(0);
  });

  it.each(['tap', 'success', 'failure', 'cash', 'navigate'] as const)('produces a short noise cue for %s with cleanup', async kind => {
    playSound(kind, true);
    await Promise.resolve();
    const context = AudioContextDouble.instances[0];
    expect(context.sources).toHaveLength(1);
    const source = context.sources[0];
    expect(source.started).toBe(true);
    expect(source.loop).toBe(false);
    expect(source.buffer!.getChannelData(0).some(value => value !== 0)).toBe(true);
    source.onended!();
    expect(source.disconnected).toBe(true);
  });

  it('keeps a single ambience loop and releases it on stop', async () => {
    startAmbient(true);
    startAmbient(true);
    await Promise.resolve();
    const context = AudioContextDouble.instances[0];
    expect(context.sources).toHaveLength(1);
    const first = context.sources[0];
    expect(first.loop).toBe(true);
    expect(first.buffer!.getChannelData(0).some(value => value !== 0)).toBe(true);
    stopAmbient();
    expect(first.stopped).toBe(true);
    startAmbient(true);
    await Promise.resolve();
    expect(first.disconnected).toBe(true);
    expect(context.sources.filter(source => source.started && !source.stopped)).toHaveLength(1);
  });

  it('closes audio resources when disposed', async () => {
    startAmbient(true);
    await Promise.resolve();
    const context = AudioContextDouble.instances[0];
    await disposeAudio();
    expect(context.state).toBe('closed');
    expect(context.sources.every(source => source.stopped && source.disconnected)).toBe(true);
  });

  it('gracefully handles devices without Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playSound('tap', true)).not.toThrow();
    expect(() => startAmbient(true)).not.toThrow();
  });
});
