import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import { startGluteEngine } from './lib/gluteEngine';
import { initAudio } from './lib/audio';
import { requestNotificationPermissionOnGesture } from './lib/notifications';

export default function App() {
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    // Both need a user gesture to succeed, so they arm listeners rather than
    // firing immediately.
    initAudio();
    requestNotificationPermissionOnGesture();

    // The glute timer runs app-wide, independent of whether its widget is
    // currently mounted or visible.
    return startGluteEngine();
  }, []);

  if (showAdmin) return <AdminPanel onClose={() => setShowAdmin(false)} />;

  return <Dashboard onOpenAdmin={() => setShowAdmin(true)} />;
}
