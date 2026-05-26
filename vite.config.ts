import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/save-my-finances/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "La Vaquita",
        short_name: "Vaquita",
        description: "Hacemos cuentas, no dramas",
        theme_color: "#2DB670",
        background_color: "#FFF6E5",
        display: "standalone",
        icons: [
          { src: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
          { src: "/favicon-128x128.png", sizes: "128x128", type: "image/png" },
          {
            src: "/favicon-256x256.png",
            sizes: "256x256",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
});
