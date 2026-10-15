import type { NextConfig } from "next";

const config: NextConfig = {
  // Internal packages ship TypeScript source.
  transpilePackages: [
    "@real-role/shared",
    "@real-role/scoring",
    "@real-role/ats",
    "@real-role/parsers",
  ],
  // jsdom is only used server-side (check page URL mode) and must not be bundled.
  serverExternalPackages: ["jsdom"],
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
        ],
      },
    ];
  },
};

export default config;
