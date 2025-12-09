/**
 * ============================================
 * AeroNyx Root Layout
 * ============================================
 * File Path: src/app/layout.tsx
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
    default: 'AeroNyx Privacy Network',
    template: '%s | AeroNyx',
  },
  description: 'Decentralized privacy network powered by Web3. Manage your nodes, monitor sessions, and earn rewards.',
  keywords: ['privacy', 'network', 'web3', 'decentralized', 'vpn', 'nodes', 'crypto'],
  authors: [{ name: 'AeroNyx' }],
  creator: 'AeroNyx',
  metadataBase: new URL('https://aeronyx.network'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://aeronyx.network',
    siteName: 'AeroNyx Privacy Network',
    title: 'AeroNyx Privacy Network',
    description: 'Decentralized privacy network powered by Web3',
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
    title: 'AeroNyx Privacy Network',
    description: 'Decentralized privacy network powered by Web3',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
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
