import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth callback codes and signed asset URLs must not enter development access logs.
  logging: false,
  async headers() {
    return [{ source: "/verify/:path*", headers: [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex" },
    ] }];
  },
};

export default nextConfig;
