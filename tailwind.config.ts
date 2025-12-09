/**
 * ============================================
 * AeroNyx Tailwind Configuration
 * ============================================
 * File Path: tailwind.config.ts
 * 
 * Creation Reason: Tailwind CSS configuration for the project
 * Main Functionality: Custom colors, fonts, animations, and utilities
 * 
 * Last Modified: v1.0.1 - Fixed content paths
 * ============================================
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    // 如果你也有 src 目录，保留这些
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary purple (matches logo)
        primary: {
          DEFAULT: '#8A2BE2',
          50: '#F5EBFF',
          100: '#E9D4FF',
          200: '#D4A8FF',
          300: '#BE7CFF',
          400: '#A855F7',
          500: '#8A2BE2',
          600: '#7B22D1',
          700: '#6B21A8',
          800: '#581C87',
          900: '#3B0764',
        },
        // Background colors
        background: {
          primary: '#0A0A0F',
          secondary: '#12121A',
          tertiary: '#1A1A24',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'gradient': 'gradient-shift 4s ease infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { 
            opacity: '1',
            boxShadow: '0 0 20px rgba(138, 43, 226, 0.3)',
          },
          '50%': { 
            opacity: '0.8',
            boxShadow: '0 0 40px rgba(138, 43, 226, 0.5)',
          },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #8A2BE2 0%, #EC4899 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
