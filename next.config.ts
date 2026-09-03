import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // GitHub Pages serves directory routes only when each route exports its own
  // index.html. This keeps /spark/ and /business/ from resolving as 404s.
  trailingSlash: true,
  basePath: process.env.GITHUB_PAGES ? '/C13b0' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
