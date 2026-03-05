import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Time Calculator",
    short_name: "TimeCalc",
    description: "Time calculator with single and multi-slot modes",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    icons: [
      { src: "/icons/128px.png", sizes: "128x128", type: "image/png" },
      { src: "/icons/512px.png", sizes: "512x512", type: "image/png" },
    ],
  }
}