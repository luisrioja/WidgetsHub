/**
 * Notifications utility — Web Notifications API + AudioContext beep
 */

let permissionGranted = false;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }

  if (Notification.permission !== 'denied') {
    const result = await Notification.requestPermission();
    permissionGranted = result === 'granted';
    return permissionGranted;
  }

  return false;
}

export function sendNotification(title: string, body: string): void {
  if (!permissionGranted && Notification.permission === 'granted') {
    permissionGranted = true;
  }

  if (permissionGranted) {
    new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'antigravity-alert',
      requireInteraction: true,
    });
  }
}

/**
 * Synthesized alarm beep via Web Audio API
 * Creates a short, aggressive two-tone beep pattern
 */
export function playAlarmBeep(): void {
  try {
    const ctx = new AudioContext();

    const playTone = (frequency: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'square';
      osc.frequency.setValueAtTime(frequency, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
      gain.gain.setValueAtTime(0.15, startTime + duration - 0.05);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Pattern: beep-beep-beep with alternating tones
    playTone(880, now, 0.12);
    playTone(660, now + 0.15, 0.12);
    playTone(880, now + 0.3, 0.12);
    playTone(660, now + 0.45, 0.12);
    playTone(1100, now + 0.65, 0.25);

    // Auto-close context after beeps finish
    setTimeout(() => ctx.close(), 2000);
  } catch (e) {
    console.warn('Could not play alarm beep:', e);
  }
}
