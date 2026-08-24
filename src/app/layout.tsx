import type { Metadata } from 'next';
import '@/styles/gameboy.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'GameBro',
  description: 'Authentic Game Boy-style game engine and Eye of the Deep',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
