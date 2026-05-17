/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['DM Sans', 'sans-serif'],
      },
      colors: {
        // GoalSync design system
        navy: {
          950: '#060d1f',
          900: '#0a1628',
          800: '#0f2040',
          700: '#162d58',
          600: '#1e3a70',
          500: '#264888',
        },
        electric: {
          600: '#1d4ed8',
          500: '#2563eb',
          400: '#3b82f6',
          300: '#60a5fa',
          200: '#93c5fd',
        },
        gs: {
          // named tokens
          bg: '#060d1f',
          surface: '#0a1628',
          panel: '#0f2040',
          border: '#162d58',
          borderLight: '#1e3a70',
          muted: '#64748b',
          text: '#e2e8f0',
          textSub: '#94a3b8',
          accent: '#2563eb',
          accentHover: '#1d4ed8',
          accentGlow: 'rgba(37,99,235,0.15)',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
        },
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)",
        'radial-glow': 'radial-gradient(ellipse at top, rgba(37,99,235,0.12) 0%, transparent 60%)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(37,99,235,0.2)',
        'glow': '0 0 24px rgba(37,99,235,0.25)',
        'glow-lg': '0 0 48px rgba(37,99,235,0.3)',
        'panel': '0 1px 3px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.03) inset',
        'card': '0 4px 24px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'count-up': 'countUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: 0, transform: 'translateX(12px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 12px rgba(37,99,235,0.2)' }, '50%': { boxShadow: '0 0 24px rgba(37,99,235,0.4)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        countUp: { from: { opacity: 0, transform: 'scale(0.8)' }, to: { opacity: 1, transform: 'scale(1)' } },
      },
      borderRadius: {
        'gs': '8px',
        'gs-lg': '12px',
        'gs-xl': '16px',
      },
    },
  },
  plugins: [],
};
