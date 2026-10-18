import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma 7 is Rust-free, but `pg` must stay a real Node dependency, not be bundled.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;
