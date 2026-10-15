import type { NextConfig } from "next";

/**
 * Content-Security-Policy. Next.js streams inline bootstrap scripts, so script-src needs
 * 'unsafe-inline' without a nonce setup; everything else is locked to this origin. form-action
 * allows GitHub because sign-in redirects there. Dev mode needs eval, so production only.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://github.com",
  "frame-ancestors 'none'",
].join("; ");

const productionHeaders =
  process.env.NODE_ENV === "production"
    ? [
        { key: "Content-Security-Policy", value: CSP },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ]
    : [];

const config: NextConfig = {
  // Internal packages ship TypeScript source.
  transpilePackages: [
    "@real-role/shared",
    "@real-role/scoring",
    "@real-role/ats",
    "@real-role/parsers",
  ],
  // jsdom is only used server-side (check page URL mode) and must not be bundled.
  serverExternalPackages: ["jsdom", "@electric-sql/pglite"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...productionHeaders,
        ],
      },
    ];
  },
};

export default config;
