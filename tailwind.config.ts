import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        // Modal backdrop
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to:   { opacity: '0' },
        },
        // Modal panel — spring slide-up from bottom
        slideUp: {
          from: { opacity: '0', transform: 'translateY(24px) scale(0.97)' },
          to:   { opacity: '1', transform: 'translateY(0)   scale(1)' },
        },
        slideDown: {
          from: { opacity: '1', transform: 'translateY(0)   scale(1)' },
          to:   { opacity: '0', transform: 'translateY(24px) scale(0.97)' },
        },
      },
      animation: {
        fadeIn:    'fadeIn    200ms ease-out',
        fadeOut:   'fadeOut   150ms ease-in',
        slideUp:   'slideUp   250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        slideDown: 'slideDown 150ms ease-in',
      },
    },
  },
  plugins: [],
};

export default config;
