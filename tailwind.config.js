/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        brand: {
          50: '#fdf8f0',
          100: '#f9eddc',
          200: '#f2d8b4',
          300: '#e9be84',
          400: '#dfa053',
          500: '#d78833',
          600: '#c87028',
          700: '#a65523',
          800: '#854522',
          900: '#6d3a1e',
        },
      },
    },
  },
  plugins: [],
}
