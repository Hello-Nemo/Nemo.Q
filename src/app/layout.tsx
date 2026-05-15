import type { Metadata } from 'next';
import { Inter, Outfit, JetBrains_Mono, Noto_Sans_SC } from 'next/font/google';
import Script from 'next/script';
import { HistoryProvider } from '@/components/HistoryContext';
import StyledJsxRegistry from './registry';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({ 
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const notoMain = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nemo.Q | Precision In, Truth Out.',
  description: 'Surgical-Grade Data Intelligence Engine powered by Vercel AI SDK',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="zh" 
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} ${notoMain.variable}`}
    >
      <head>
        {/* CRITICAL CSS INLINE - Ensures layout is correct before external CSS/JS loads */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body { 
            height: 100%; 
            margin: 0; 
            padding: 0; 
            overflow: hidden;
            background: #FFFFFF; /* Default Light */
          }
          [data-theme='dark'] { background: #0B0F1A; }
          
          /* Critical Infrastructure Classes */
          .workbench-root { display: flex; height: 100vh; width: 100vw; overflow: hidden; }
          .workbench-body { flex: 1; display: flex; flex-direction: row; height: 100%; overflow: hidden; min-width: 0; }
          .chat-col { flex: 1; min-width: 0; display: flex; flex-direction: column; height: 100%; position: relative; overflow: hidden; }
          .canvas-col { flex-shrink: 0; height: 100%; display: flex; border-left: 1px solid rgba(15, 23, 42, 0.08); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
          .sidebar-slot { flex-shrink: 0; height: 100%; border-right: 1px solid rgba(15, 23, 42, 0.08); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        ` }} />
      </head>
      <body suppressHydrationWarning>
        <Script src="/theme.js" strategy="afterInteractive" />
        <StyledJsxRegistry>
          <HistoryProvider>
            {children}
          </HistoryProvider>
        </StyledJsxRegistry>
      </body>
    </html>
  );
}
