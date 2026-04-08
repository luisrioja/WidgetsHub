import Dashboard from './components/Dashboard';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <>
      <Dashboard />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#111111',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            letterSpacing: '0.05em',
          },
        }}
        theme="dark"
      />
    </>
  );
}
