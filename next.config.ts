import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg.wasm carrega core via CDN (jsDelivr) no browser
  // Worker OpenNext usa nodejs_compat
  env: {
    // Garante URL do Pay no bundle client (não depende só de secret runtime)
    NEXT_PUBLIC_NULLYSH_PAY_URL:
      process.env.NEXT_PUBLIC_NULLYSH_PAY_URL ||
      process.env.NULLYSH_PAY_URL ||
      "https://pay.nullysh.com",
  },
};

export default nextConfig;

// Integra bindings Cloudflare no `next dev` (quando wrangler/dev.vars existirem)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
