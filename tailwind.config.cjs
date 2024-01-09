/** @type {import('tailwindcss').Config}*/
const config = {
  content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // flowbite-svelte
        primary: {
          50: '#FFF5F2',
          100: '#FFF1EE',
          200: '#FFE4DE',
          300: '#FFD5CC',
          400: '#FFBCAD',
          500: '#FE795D',
          600: '#EF562F',
          700: '#EB4F27',
          800: '#CC4522',
          900: '#A5371B'
        },
        gray: {
          50: '#F9F9F9',
          100: '#ECECEC',
          200: '#D3D3D3',
          300: '#B9B9B9',
          400: '#A0A0A0',
          500: '#868686',
          600: '#6D6D6D',
          700: '#535353',
          800: '#393939',
          900: '#202020',
          950: '#1A1A1A'
        },
      }
    }
  },

  plugins: [require('flowbite/plugin')],
};

module.exports = config;
