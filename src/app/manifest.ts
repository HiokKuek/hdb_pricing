import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HDB Pricing",
    short_name: "HDB Pricing",
    description: "Explore recent HDB resale flat prices across Singapore.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
