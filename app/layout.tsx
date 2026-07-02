import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "신정개발 경영지원 대시보드",
  description:
    "엑셀 파일 기반 경영지원 관리 대시보드 — 데이터는 브라우저 안에서만 처리됩니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
