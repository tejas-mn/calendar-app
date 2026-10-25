import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["pwa-192.svg", "pwa-512.svg"],
			manifest: {
				name: "Calendar Planner",
				short_name: "Planner",
				description: "A personal calendar and weekly planning workspace.",
				start_url: "/",
				scope: "/",
				display: "standalone",
				orientation: "any",
				background_color: "#11151e",
				theme_color: "#11151e",
				icons: [
					{
						src: "/pwa-192.svg",
						sizes: "192x192",
						type: "image/svg+xml",
						purpose: "any maskable",
					},
					{
						src: "/pwa-512.svg",
						sizes: "512x512",
						type: "image/svg+xml",
						purpose: "any maskable",
					},
				],
			},
		}),
	],
});
