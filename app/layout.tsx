/**
 * ============================================
 * AeroNyx Root Layout
 * ============================================
 * File Path: app/layout.tsx
 * 
 * Creation Reason: Next.js 14 App Router root layout
 * Main Functionality: Wrap app with providers, fonts, and global styles
 * Dependencies:
 *   - next/font (font loading)
 *   - @tanstack/react-query (data fetching)
 *   - src/app/globals.css
 * 
 * Main Logical Flow:
 * 1. Load custom fonts (Geist)
 * 2. Set up QueryClient provider
 * 3. Initialize auth state on mount
 * 4. Apply global styles and metadata
 * 
 * ⚠️ Important Note for Next Developer:
 * - All providers must be client components
 * - Auth initialization happens in Providers component
 * - Metadata is defined for SEO
 * 
 * Last Modified: v1.0.0 - Initial root layout
 * Last Modified: v1.1.0 - Dashboard icon and app-domain metadata alignment
 * ============================================
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// ============================================
// Font Configuration
// ============================================

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// ============================================
// Metadata Configuration
// ============================================

export const metadata: Metadata = {
  title: {
    default: 'AeroNyx Nodeboard',
    template: '%s | AeroNyx',
  },
  description: 'Operator dashboard for AeroNyx Privacy Network decentralized nodes. Manage nodes, monitor aggregate protocol health, and review operational readiness.',
  keywords: ['AeroNyx Nodeboard', 'AeroNyx Privacy Network', 'AeroNyx Privacy Protocol', 'decentralized nodes', 'node operator dashboard', 'protocol health', 'encrypted relay'],
  authors: [{ name: 'AeroNyx' }],
  creator: 'AeroNyx',
  metadataBase: new URL('https://app.aeronyx.network'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://app.aeronyx.network',
    siteName: 'AeroNyx Nodeboard',
    title: 'AeroNyx Nodeboard',
    description: 'Operator dashboard for AeroNyx Privacy Network decentralized nodes.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AeroNyx Privacy Network',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AeroNyx Nodeboard',
    description: 'Operator dashboard for AeroNyx Privacy Network decentralized nodes.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon-16x16.png',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0A0A0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

// ============================================
// Root Layout Component
// ============================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-[#0A0A0F] text-white antialiased">
        <Providers>
          {/* Background Effects */}
          <div className="fixed inset-0 -z-10">
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-grid opacity-30" />
            
            {/* Radial Gradient */}
            <div className="absolute inset-0 bg-radial-gradient" />
            
            {/* Noise Texture */}
            <div className="absolute inset-0 bg-noise" />
          </div>

          {/* Main Content */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
