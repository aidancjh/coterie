import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // logo-mark.png is precached because the waitlist pages render it via
      // <img src>: uncached, a reload on a bad connection paints a broken-image
      // icon. (The boot splash no longer fetches it at all — it inlines the
      // mark as a data URI, see index.html.)
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "logo-mark.png"],
      manifest: {
        name: "Coterie — Volleyball for all",
        short_name: "Coterie",
        description:
          "Find a volleyball game near you and claim a spot in seconds. Every game shows its skill level, its cost and who's already playing — and every level is welcome.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Always show the newest version when online: fetch the page and API
        // from the network first, falling back to cache only when offline.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // Paths the SERVER renders, which must never be answered from the
        // precached index.html. Workbox registers this NavigationRoute before
        // the runtimeCaching rules below and matches in registration order, so
        // anything not denylisted here is served the SPA shell — the network is
        // never consulted. /unlock is the one that bites: the SPA has no such
        // route, so it falls through to the catch-all inside RequireAuth and
        // redirects a logged-out visitor to /auth, making the access-gate
        // password page unreachable in any browser that has the worker.
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/unlock/,
          /^\/healthz/,
          /^\/robots\.txt$/,
        ],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages",
              networkTimeoutSeconds: 4,
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    // Forward API calls to the Express server during local dev so the
    // frontend can just fetch("/api/...") regardless of the API port.
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
