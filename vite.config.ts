import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: '/save-my-finances/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "Save My Finances",
        short_name: "Finances",
        description: "Offline savings tracker",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        icons: [{ src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
});
