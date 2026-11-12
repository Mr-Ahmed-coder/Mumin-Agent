/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F4F7FC',
          100: '#DCE4F2',
          500: '#2F63F5',
          600: '#2F63F5',
          700: '#2452D6',
          900: '#162447',
        },
        ink: '#162447',
        canvas: '#F4F7FC',
        line: '#DCE4F2',
        muted: '#6B7A99',
        blue: {
          50: '#F4F7FC', 100: '#DCE4F2', 200: '#DCE4F2',
          300: '#2F63F5', 400: '#2F63F5', 500: '#2F63F5',
          600: '#2F63F5', 700: '#2F63F5', 800: '#2452D6', 900: '#162447',
        },
        slate: {
          50: '#F4F7FC',
          100: '#162447',
          200: '#162447',
          300: '#162447',
          400: '#6B7A99',
          500: '#6B7A99',
          600: '#6B7A99',
          700: '#DCE4F2',
          800: '#DCE4F2',
          850: '#F4F7FC',
          900: '#ffffff',
          950: '#F4F7FC',
        },
      },
      boxShadow: {
        soft: '0 18px 55px -30px rgba(40, 73, 145, 0.35)',
        card: '0 12px 35px -24px rgba(48, 74, 135, 0.35)',
      },
    },
  },
  plugins: [],
};
