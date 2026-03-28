import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#6C3CE1", light: "#A78BFA", dark: "#4C1D95" },
        accent: { DEFAULT: "#F59E0B", light: "#FCD34D" },
        game: {
          conquered: "#10B981",
          decaying: "#F59E0B",
          enemy: "#EF4444",
          fog: "#6B7280",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "system-ui", "sans-serif"],
      },
      animation: {
        "fog-dissolve": "fogDissolve 1.5s ease-out forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fogDissolve: {
          "0%": { opacity: "1", filter: "blur(8px)" },
          "100%": { opacity: "0", filter: "blur(0px)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(108,60,225,0.5)" },
          "50%": { boxShadow: "0 0 20px rgba(108,60,225,0.8)" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
