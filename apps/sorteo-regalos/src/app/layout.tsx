import { UiStringsProvider } from '@jcsoftdev/ui/i18n';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sorteo de regalos',
  description: 'Amigo secreto anónimo, con personas que no se conocen entre sí.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="es" data-density="touch">
      <body>
        <UiStringsProvider locale="es">{children}</UiStringsProvider>
      </body>
    </html>
  );
}
