/**
 * ============================================
 * AeroNyx Next.js Configuration
 * ============================================
 * File Path: next.config.js
 * 
 * Creation Reason: Next.js configuration for the project
 * Main Functionality: Build settings, image domains, and optimizations
 * 
 * Last Modified: v1.0.0 - Initial configuration
 * ============================================
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.aeronyx.network',
      },
    ],
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/nodes',
        destination: '/dashboard/nodes',
        permanent: true,
      },
      {
        source: '/codes',
        destination: '/dashboard/codes',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
