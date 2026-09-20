/*
 * 루트 레이아웃 — lang="ko", Google Fonts(Instrument Serif / Inter / JetBrains Mono) 링크 로드.
 * next/font/google 은 빌드 시 네트워크가 필요해 실패할 수 있어 <link> 로 직접 로드합니다.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "pablo-jev-test1 — find what makes them buy",
  description:
    "경쟁사 마케팅 포스트를 jev 판정 모델로 대량 분석하고 우리 브랜드 시안을 만드는 라이브 런 대시보드",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* App Router 루트 레이아웃의 <link> 는 모든 페이지에 적용됨 — pages/_document 전용 규칙이라 예외 처리 */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-page text-ink antialiased">{children}</body>
    </html>
  );
}
