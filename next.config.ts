import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Gera .next/standalone — um bundle que roda com `node server.js` sem
   * precisar de node_modules. É o que o Dockerfile copia para a imagem final,
   * e o que mantém a imagem pequena o suficiente para uma VPS de 2 vCPU.
   */
  output: "standalone",

  images: {
    /**
     * Hosts externos de onde vêm imagens no site original.
     * Sem isto, next/image recusa a URL em produção.
     */
    remotePatterns: [
      { protocol: "https", hostname: "ddragon.leagueoflegends.com" },
      { protocol: "https", hostname: "raw.communitydragon.org" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // Headers de segurança portados do vercel.json do site atual, que já estavam corretos.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
