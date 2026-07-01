/**
 * ============================================
 * AeroNyx Next.js Configuration
 * ============================================
 * File Path: next.config.js
 *
 * Creation Reason: Next.js configuration for the project
 * Main Functionality: Build settings, image domains, and optimizations
 *
 * Last Modified: v1.1.0 - Add apple-app-site-association Content-Type header (Universal Links)
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
      {
        // [UNIVERSAL-LINKS] The AASA file has no extension, so it would be served as
        // octet-stream; iOS wants application/json. Force it here. assetlinks.json keeps
        // its .json extension and needs no override.
        source: '/.well-known/apple-app-site-association',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
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
