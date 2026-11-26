const c = (name) => `hsl(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: c('background'),
        sidebar: c('sidebar'),
        surface: c('surface'),
        sunken: c('sunken'),
        foreground: c('foreground'),
        subtle: c('subtle'),
        faint: c('faint'),
        line: c('line'),
        'line-strong': c('line-strong'),
        accent: c('accent'),
        'accent-foreground': c('accent-foreground'),
        success: c('success'),
        warning: c('warning'),
        danger: c('danger'),
        info: c('info'),
      },
      fontFamily: {
        sans: [
          'Inter',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei UI"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
        serif: [
          '"Source Han Serif SC"',
          '"Noto Serif SC"',
          '"Songti SC"',
          'STSong',
          'SimSun',
          'serif',
        ],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', '"Sarasa Mono SC"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px hsl(var(--shadow) / 0.06), 0 4px 16px hsl(var(--shadow) / 0.06)',
        pop: '0 8px 30px hsl(var(--shadow) / 0.18), 0 2px 6px hsl(var(--shadow) / 0.1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        'rec-pulse': {
          '0%': { boxShadow: '0 0 0 0 hsl(var(--danger) / 0.45)' },
          '100%': { boxShadow: '0 0 0 18px hsl(var(--danger) / 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'slide-up': 'slide-up 0.22s ease-out',
        'slide-in-right': 'slide-in-right 0.22s ease-out',
        shimmer: 'shimmer 2.4s linear infinite',
        blink: 'blink 1s steps(2) infinite',
        'rec-pulse': 'rec-pulse 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
}
