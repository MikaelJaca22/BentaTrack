/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        black: '#000000',
        ink: '#0A0A0A',
        gray900: '#171717',
        gray800: '#262626',
        gray600: '#525252',
        gray500: '#737373',
        gray400: '#A3A3A3',
        gray300: '#D4D4D4',
        gray200: '#E5E5E5',
        gray100: '#F5F5F5',
        white: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
};
