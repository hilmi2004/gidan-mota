/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Poppins', 'monospace'],
      },
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        ink: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        line: 'var(--border-subtle)',
        brand: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        signal: {
          amber: '#D97706',
          amberLight: '#FEF3C7',
          danger: '#DC2626',
          dangerLight: '#FEE2E2',
          info: '#0284C7',
        },
      },
      borderRadius: {
        control: '8px',
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 20, 25, 0.04), 0 1px 3px 0 rgba(15, 20, 25, 0.03)',
        cardHover: '0 8px 20px -4px rgba(15, 20, 25, 0.08), 0 2px 6px -1px rgba(15, 20, 25, 0.04)',
      },
    },
  },
  plugins: [],
};

