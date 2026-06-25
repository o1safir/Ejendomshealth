/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A1D1A",
        paper: "#F7F6F2",
        slate: "#5B6760",
        line: "#DAD7CD",
        accent: "#3D5A45",   // dyb grøn, refererer til "health"-konceptet uden at blive klinisk
        warn: "#9A5B2E",
        good: "#3D5A45",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
