import type { Metadata } from "next";
import "./globals.css";
import { ProjectProvider } from "./contexts/ProjectContext";
import ClientLayout from "./components/ClientLayout";

export const metadata: Metadata = {
  title: "건설사업 사후평가 AI — 건설공사 사후평가서 자동작성",
  description: "AI 기반 건설공사 사후평가서 자동작성 시스템. RAG 기술을 활용하여 사업수행성과 평가표를 자동으로 생성합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
