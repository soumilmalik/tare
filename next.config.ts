import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision: Date.now().toString() }],
});

// The service worker is only built for production (`npm run build`, which uses
// webpack). `npm run dev` uses Turbopack and runs without it.
export default process.env.NODE_ENV === "development" ? nextConfig : withSerwist(nextConfig);
