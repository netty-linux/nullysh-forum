import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg.wasm carrega core via CDN (jsDelivr) no browser
  // Worker OpenNext usa nodejs_compat
};

export default nextConfig;

// Integra bindings Cloudflare no `next dev` (quando wrangler/dev.vars existirem)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
