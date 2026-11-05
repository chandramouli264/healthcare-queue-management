/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effefb', 100: '#c8fff4', 200: '#91feea', 300: '#53f5dc', 400: '#1fe0c8',
          500: '#06c4af', 600: '#019e8f', 700: '#067e74', 800: '#0a645e', 900: '#0d524e', 950: '#003231',
        },
        ink: { 50: '#f6f8fa', 100: '#eceff3', 200: '#d5dbe3', 300: '#b0bccb', 400: '#8596ad', 500: '#667a93', 600: '#51627a', 700: '#425063', 800: '#394454', 900: '#1f2733', 950: '#141a23' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.08)' },
    },
  },
  plugins: [],
};
