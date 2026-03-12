import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 액션 대용량 파일 처리
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // 환경변수
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  },
};

export default nextConfig;
