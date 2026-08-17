/**
 * Web Notifications wrapper.
 *
 * Permission is requested on the first user gesture rather than on mount —
 * Chrome silently rejects an unprompted request and then the widget can never
 * ask again for the origin.
 */

const supported = typeof window !== 'undefined' && 'Notification' in window;

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return supported ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/** Attaches a one-shot gesture listener that asks for permission. */
export function requestNotificationPermissionOnGesture(): void {
  if (!supported || Notification.permission !== 'default') return;

  const ask = () => {
    detach();
    void requestNotificationPermission();
  };
  const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown'];
  const detach = () => events.forEach((e) => window.removeEventListener(e, ask));
  events.forEach((e) => window.addEventListener(e, ask, { passive: true }));
}

interface NotifyOptions {
  /** Collapses repeats of the same alert into one entry. */
  tag?: string;
  /** Re-alerts the user when a notification with the same tag is replaced. */
  renotify?: boolean;
  /** Keeps the notification on screen until dismissed. */
  sticky?: boolean;
}

export function sendNotification(
  title: string,
  body: string,
  { tag = 'widgethub', renotify = false, sticky = false }: NotifyOptions = {},
): Notification | null {
  if (!supported || Notification.permission !== 'granted') return null;

  try {
    return new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag,
      requireInteraction: sticky,
      // `renotify` is not in every lib.dom version but is honoured by Chrome.
      ...(renotify ? { renotify: true } : {}),
    } as NotificationOptions);
  } catch {
    return null;
  }
}
