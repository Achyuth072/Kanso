import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    clearMocks: true,
    setupFiles: ["./tests/unit/setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    include: ["./tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
  },
});
