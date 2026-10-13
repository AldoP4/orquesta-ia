import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // drei <Html> desmonta raíces de React durante el doble render de StrictMode en dev.
  reactStrictMode: false,
  // Sin el indicador flotante de Next.js en desarrollo (ensucia grabaciones y capturas).
  devIndicators: false,
};

export default nextConfig;
