/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        korintek: {
          navy: '#0A1F2C',
          ink: '#0A1F2C',
          teal: '#00BAD2',
          tealDark: '#009BB0',
          tealLighter: '#E6F9FB',
          gold: '#BF953F',
        },
      },
      fontFamily: {
        heading: ['Manrope', '-apple-system', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(10, 31, 44, 0.08), 0 1px 2px rgba(10, 31, 44, 0.04)',
      },
    },
  },
  plugins: [],
};
