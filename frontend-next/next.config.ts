import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite imagens de qualquer domínio (para futuro)
  images: { unoptimized: true },
  // Necessário para deploy no Vercel com API externa
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },
};

export default nextConfig;
