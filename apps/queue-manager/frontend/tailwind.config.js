/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        korintek: {
          teal: '#00BAD2',      // couleur de marque exacte, extraite du logo KORINTEK
          tealDark: '#00808F',
          tealDarker: '#005B66',
          tealLight: '#E3F8FA',
          tealLighter: '#F2FCFD',
          ink: '#0F172A',
        },
      },
      fontFamily: {
        heading: ['Manrope', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        system: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
        ],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 8px -2px rgb(15 23 42 / 0.06)',
        cardHover: '0 4px 16px -4px rgb(0 186 210 / 0.18)',
      },
    },
  },
  plugins: [],
};
