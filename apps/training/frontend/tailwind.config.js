/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        korintek: {
          navy: '#0A1F2C',      // Primary Navy — règles projet KORINTEK LMS
          teal: '#00BAD2',      // Primary Teal
          gold: '#BF953F',      // Gold Accent
          goldLight: '#DEBD6F',
          bg: '#F8F9FA',        // Background officiel
          tealDark: '#00808F',
          tealLighter: '#F2FCFD',
          ink: '#0F172A',
        },
      },
      fontFamily: {
        heading: ['Manrope', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 8px -2px rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
};
