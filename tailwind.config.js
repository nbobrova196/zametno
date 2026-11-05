/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f7f4ee',
        surface: '#ffffff',
        ink: '#1c1b19',
        muted: '#6b665e',
        line: '#e3ddd2',
        forest: {
          50: '#eff5f2',
          100: '#d9e8e1',
          200: '#b4d1c4',
          300: '#85b3a1',
          400: '#55907b',
          500: '#35745f',
          600: '#1f5f4f',
          700: '#1a4c40',
          800: '#163d34',
          900: '#122f29',
        },
        amber: {
          100: '#fbf0d9',
          200: '#f5dca9',
          400: '#e0a03a',
          500: '#c8862a',
          600: '#a56a20',
        },
        clay: '#b4553f',
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.15rem' }],
        sm: ['0.9375rem', { lineHeight: '1.4rem' }],
        base: ['1.0625rem', { lineHeight: '1.6rem' }],
      },
      fontFamily: {
        sans: [
          'Nunito Variable',
          'Nunito',
          'ui-rounded',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          'Comfortaa Variable',
          'Comfortaa',
          'Nunito Variable',
          'Nunito',
          'ui-rounded',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(28, 27, 25, 0.04), 0 8px 24px -12px rgba(28, 27, 25, 0.18)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
