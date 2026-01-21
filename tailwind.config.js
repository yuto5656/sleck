/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slack: {
          purple: '#4A154B',
          'purple-dark': '#350d36',
          'purple-light': '#611f69',
          green: '#2BAC76',
          blue: '#1264A3',
          yellow: '#ECB22E',
          red: '#E01E5A',
        },
        sidebar: {
          DEFAULT: '#3F0E40',
          hover: '#350D36',
          active: '#1164A3',
          text: '#FFFFFF',
          'text-muted': '#CFC3CF',
        }
      },
    },
  },
  plugins: [],
}
