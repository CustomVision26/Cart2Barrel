import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Out-of-stock / receipt uploads allow up to 8 MB per image (see lib validators).
      bodySizeLimit: "52mb",
    },
  },
  images: {
    localPatterns: [
      {
        pathname: "/amani-cart2barrel-logo.png",
        search: "",
      },
    ],
  },
  /** Dev-only: allow HMR / _next when loading the app via a tunnel host. */
  allowedDevOrigins: ["cart2barrelstripe.ngrok.app"],
  async redirects() {
    return [
      { source: "/sign-in", destination: "/login", permanent: true },
      { source: "/sign-in/:path*", destination: "/login/:path*", permanent: true },
      { source: "/sign-up", destination: "/signup", permanent: true },
      { source: "/sign-up/:path*", destination: "/signup/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
