/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}", "./src/app.html"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b1220",
          900: "#0f172a",
          800: "#1e293b",
        },
      },
    },
  },
  plugins: [],
};
