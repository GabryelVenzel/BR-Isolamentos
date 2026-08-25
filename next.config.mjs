/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer (v4) é ESM-only — sem isso, o build do Next tenta
  // tratá-lo como CommonJS externo no bundle de servidor e falha
  // ("ESM packages need to be imported"), mesmo sendo usado só em
  // componentes client (ver app/orcamento/[id]/download-pdf/page.tsx).
  transpilePackages: ["@react-pdf/renderer"],
};

export default nextConfig;
