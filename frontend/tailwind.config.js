/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary':   '#050d1a',
        'bg-secondary': '#0a1628',
        'bg-card':      '#0d1f35',
        'border-dim':   '#1a3a5c',
        'accent-blue':  '#0ea5e9',
        'accent-green': '#10b981',
        'accent-gold':  '#f59e0b',
        'accent-purple':'#8b5cf6',
        'critical':     '#ef4444',
        'warning':      '#f97316',
        'txt-primary':  '#e2e8f0',
        'txt-secondary':'#94a3b8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':   'spin 8s linear infinite',
        'glow':        'glow 2s ease-in-out infinite alternate',
        'slide-in':    'slideIn 0.3s ease-out',
        'fade-in':     'fadeIn 0.4s ease-out',
        'count-up':    'countUp 1s ease-out',
      },
      keyframes: {
        glow: {
          '0%':   { boxShadow: '0 0 5px rgba(14,165,233,0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(14,165,233,0.7)' },
        },
        slideIn: {
          '0%':   { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'card':     '0 4px 24px rgba(0,0,0,0.4)',
        'glow-blue':'0 0 30px rgba(14,165,233,0.2)',
        'glow-green':'0 0 30px rgba(16,185,129,0.2)',
        'glow-gold': '0 0 30px rgba(245,158,11,0.2)',
        'critical':  '0 0 20px rgba(239,68,68,0.3)',
      },
    },
  },
  plugins: [],
}
