import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 祝詞アプリ（/norito）用：夜の紺と金
        nr: {
          bg: "#10131e",
          panel: "#171b29",
          raised: "#1e2334",
          line: "#2a3047",
          text: "#ece6d6",
          muted: "#9a9fb0",
          gold: "#c9a35a",
          goldSoft: "#3a3020",
        },
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
      fontFamily: {
        mincho: ['"Hiragino Mincho ProN"', '"Yu Mincho"', '"YuMincho"', '"Noto Serif JP"', "serif"],
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
