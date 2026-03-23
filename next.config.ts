import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["192.168.50.58", ".loca.lt", ".ngrok-free.dev"],
};

export default nextConfig;
