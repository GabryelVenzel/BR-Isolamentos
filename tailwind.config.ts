import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#003366",
          dark: "#00264d",
          light: "#e6eef2",
        },
        accent: {
          DEFAULT: "#198754",
          dark: "#146c43",
          light: "#e6f2e6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
