/**
 * Audio output for alarms.
 *
 * Browsers refuse to start an AudioContext outside a user gesture, which is why
 * the previous `new AudioContext()`-per-beep approach was silent most of the
 * time. Here a single context is created lazily and resumed on the first
 * interaction of the session, then reused for every later alarm.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

type AudioContextCtor = typeof AudioContext;

function getCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = getCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** Call once at startup. Attaches one-shot listeners that unlock playback. */
export function initAudio(): void {
  if (typeof window === 'undefined' || unlocked) return;

  const unlock = () => {
    const c = ensureContext();
    if (!c) return;
    void c.resume().then(() => {
      unlocked = c.state === 'running';
      if (unlocked) detach();
    });
  };

  const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
  const detach = () => events.forEach((e) => window.removeEventListener(e, unlock));

  events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
}

export function isAudioUnlocked(): boolean {
  return unlocked && ctx?.state === 'running';
}

interface Tone {
  /** Hz */
  freq: number;
  /** Seconds from the start of the pattern. */
  at: number;
  /** Seconds. */
  dur: number;
}

function playPattern(tones: Tone[], volume: number): void {
  const c = ensureContext();
  if (!c) return;

  // A tab that has been backgrounded can suspend the context; resume is a
  // no-op once it is already running.
  if (c.state === 'suspended') void c.resume();

  const start = c.currentTime + 0.02;

  for (const tone of tones) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(tone.freq, start + tone.at);

    // Short ramps avoid the click that a hard gate produces on a square wave.
    const t0 = start + tone.at;
    const t1 = t0 + tone.dur;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.setValueAtTime(volume, t1 - 0.03);
    gain.gain.linearRampToValueAtTime(0, t1);

    osc.start(t0);
    osc.stop(t1 + 0.01);
  }
}

/** Rest finished — insistent, three rising pairs. */
export function playAlarm(volume = 0.18): void {
  playPattern(
    [
      { freq: 880, at: 0, dur: 0.11 },
      { freq: 660, at: 0.15, dur: 0.11 },
      { freq: 880, at: 0.3, dur: 0.11 },
      { freq: 660, at: 0.45, dur: 0.11 },
      { freq: 1170, at: 0.62, dur: 0.26 },
    ],
    volume,
  );
}

/** Repeat reminder while the session is still pending — shorter, less shouty. */
export function playNag(volume = 0.13): void {
  playPattern(
    [
      { freq: 880, at: 0, dur: 0.09 },
      { freq: 1170, at: 0.13, dur: 0.14 },
    ],
    volume,
  );
}

/** Activation finished. */
export function playComplete(volume = 0.14): void {
  playPattern(
    [
      { freq: 660, at: 0, dur: 0.1 },
      { freq: 880, at: 0.12, dur: 0.1 },
      { freq: 1320, at: 0.24, dur: 0.22 },
    ],
    volume,
  );
}

/** Last three seconds of an activation. */
export function playTick(volume = 0.08): void {
  playPattern([{ freq: 1320, at: 0, dur: 0.05 }], volume);
}
