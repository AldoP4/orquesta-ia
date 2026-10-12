import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // drei <Html> desmonta raíces de React durante el doble render de StrictMode en dev.
  reactStrictMode: false,
};

export default nextConfig;
