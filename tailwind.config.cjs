/** @type {import('tailwindcss').Config}*/
const config = {
  content: [
    "./src/**/*.{html,js,svelte,ts}",
    "./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-5px)" },
          "100%": { opacity: "1" },
        },
        lslideIn: {
          "0%": { opacity: "0", transform: "translateX(5px)" },
          "100%": { opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(5px)" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "100%": { opacity: "0", transform: "translateY(5px)" },
          "0%": { opacity: "1" },
        },
      },
      animation: {
        sideIn: "slideIn 1s ease forwards",
        lsideIn: "lslideIn 1s ease forwards",
        fadeIn: "fadeIn 1s ease forwards",
        fadeOut: "fadeOut 1s ease forwards",
      },
      transitionProperty: {
        "width": "width",
      },
      colors: {
        // flowbite-svelte
        primary: {
          DEFAULT: "#FA1C74",
          50: "#FED0E2",
          100: "#FEBCD6",
          200: "#FD94BD",
          300: "#FC6CA5",
          400: "#FB448C",
          500: "#FA1C74",
          600: "#D90559",
          700: "#A20442",
          800: "#6B022C",
          900: "#340115",
          950: "#19010A",
        },
        gray: {
          50: "#F9F9F9",
          100: "#ECECEC",
          200: "#D3D3D3",
          300: "#B9B9B9",
          400: "#A0A0A0",
          500: "#868686",
          600: "#6D6D6D",
          700: "#535353",
          800: "#393939",
          900: "#202020",
          950: "#1A1A1A",
        },
      },
    },
  },

  plugins: [require("flowbite/plugin")],
};

module.exports = config;
