import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tolva",
    short_name: "Tolva",
    description: "Gestioná tus boletas y finanzas en un solo lugar",
    start_url: "/",
    display: "standalone",
    background_color: "#020617", // matching oklch(0.16 0.03 250) - slate-950
    theme_color: "#4382B1", // matching petroleum blue oklch(0.60 0.10 240)
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
