import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // JSX for the render tests (tsconfig keeps "preserve" for Next.js).
  oxc: { jsx: { runtime: "automatic" } },
  test: { include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"] },
});
