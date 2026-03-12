import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: { entry: "src/index.ts" },
  splitting: true,
  sourcemap: true,
  clean: true,
  target: "node22",
});
