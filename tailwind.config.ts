import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0f0f10",
          panel: "#181818",
          input: "#212121",
          border: "#2a2a2a",
        },
        role: {
          user: "#e5e5e5",
          staff: "#3b82f6",
          admin: "#ef4444",
          adminGold: "#d4af37",
        },
        name: {
          purple: "#a855f7",
          blue: "#3b82f6",
          red: "#ef4444",
          green: "#22c55e",
          gold: "#d4af37",
          silver: "#c0c0c0",
          pink: "#ec4899",
          black: "#9ca3af",
        },
      },
      animation: {
        fadeIn: "fadeIn 0.7s ease-in both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
