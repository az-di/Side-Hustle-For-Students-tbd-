import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma 7 is Rust-free, but `pg` must stay a real Node dependency, not be bundled.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  experimental: {
    serverActions: {
      // Portfolio uploads arrive through a server action. Keep this a little
      // above MEDIA_MAX_FILE_BYTES so the action's own error message wins.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
