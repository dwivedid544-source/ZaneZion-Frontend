/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0F0F11",
        sidebar: "#141417",
        card: "#1C1C21",
        border: "#2A2A30",
        accent: {
          DEFAULT: "#C8A96A",
          hover: "#E5D3A3",
        },
        primary: "#FFFFFF",
        secondary: "#A1A1AA",
        muted: "#6B7280",
        success: "#22C55E",
        warning: "#FACC15",
        danger: "#EF4444",
        info: "#3B82F6",
      },
      fontFamily: {
        heading: ["'Playfair Display'", "serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
      },
    },
  },
  plugins: [],
}
