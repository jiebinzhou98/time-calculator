import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tower Tools",
    short_name: "Tower Tools",
    description: "Research timing and Wall survival for The Tower",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1015",
    theme_color: "#0b1015",
    icons: [
      { src: "/icons/128px.png", sizes: "128x128", type: "image/png" },
      { src: "/icons/512px.png", sizes: "512x512", type: "image/png" },
    ],
  }
}