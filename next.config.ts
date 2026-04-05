import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: process.env.GITHUB_PAGES ? '/C13b0' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
