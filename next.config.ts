import type { NextConfig } from "next";
import nextPwa from "next-pwa"

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
};

const withPWA = nextPwa({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})

export default nextConfig;
