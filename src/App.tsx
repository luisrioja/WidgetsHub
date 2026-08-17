import { useEffect } from 'react';
import Dashboard from './components/Dashboard';
import { startGluteEngine } from './lib/gluteEngine';
import { initAudio } from './lib/audio';
import { requestNotificationPermissionOnGesture } from './lib/notifications';

export default function App() {
  useEffect(() => {
    // Both need a user gesture to succeed, so they arm listeners rather than
    // firing immediately.
    initAudio();
    requestNotificationPermissionOnGesture();

    // The glute timer runs app-wide, independent of whether its widget is
    // currently mounted or visible.
    return startGluteEngine();
  }, []);

  return <Dashboard />;
}
