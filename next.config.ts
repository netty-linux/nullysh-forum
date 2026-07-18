import type { NextConfig } from "next";

/**
 * Headers de segurança HTTP (OWASP A05).
 * CSP: 'unsafe-inline'/'unsafe-eval' necessários p/ Next.js + ffmpeg.wasm.
 * TODO(security): migrar scripts para nonces; self-host ffmpeg em /public/ffmpeg.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // Chat usa câmera/microfone no composer; geolocation no post location
    value:
      "camera=(self), microphone=(self), geolocation=(self), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
      "img-src 'self' data: blob: https: https://*.supabase.co",
      "media-src 'self' blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://pay.nullysh.com https://www.asaas.com https://cdn.jsdelivr.net https://api.fontshare.com https://cdn.fontshare.com",
      "font-src 'self' data: https://cdn.fontshare.com https://api.fontshare.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://pay.nullysh.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // ffmpeg.wasm: core via CDN (jsDelivr) — ver CSP + TODO self-host
  env: {
    NEXT_PUBLIC_NULLYSH_PAY_URL:
      process.env.NEXT_PUBLIC_NULLYSH_PAY_URL ||
      process.env.NULLYSH_PAY_URL ||
      "https://pay.nullysh.com",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

// Integra bindings Cloudflare no `next dev` (quando wrangler/dev.vars existirem)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
