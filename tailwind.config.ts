import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        rise: {
          ink: "#17202a",
          navy: "#1f4d68",
          teal: "#1f8a8a",
          mint: "#b7e4d6",
          gold: "#f2b84b",
          cloud: "#f5f7fb"
        }
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 32, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
