import './globals.css';
import Navigation from '../components/Navigation';

export const metadata = {
  title: 'TutorPulse',
  description: 'Time-Aware Tutor Schedule',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 min-h-screen antialiased pb-20">
        {children}
        <Navigation />
      </body>
    </html>
  );
}