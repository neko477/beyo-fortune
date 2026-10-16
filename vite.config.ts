import { defineConfig } from "vite";

export default defineConfig({
  base: "/beyo-fortune/",
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true
  }
});
