/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hardwood: "#1A130B",
        court: "#0E1A2B",
        parquet: "#C77B3F",
        chalk: "#F2EEE4",
        buzzer: "#E8442C",
        amber: "#FFB627",
        line: "#2A3A52",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};
