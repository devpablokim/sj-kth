/*
 * PostTile — 모자이크 한 칸. thumbnailUrl 이 있으면 이미지(+하단 그라데이션 스크림 위 브랜드/채널명),
 * 없으면 플랫폼 색 배경 위에 브랜드 + 본문 앞 40자를 아주 작게 찍는 텍스트 타일.
 * 상태(idle/analyzing/done/error)에 따라 빨간 테두리 · 체크 뱃지 · 에러 뱃지를 표시하고,
 * AI 생성 예시(post.generated)는 좌상단에 흰 "예시" 뱃지를 붙입니다.
 */
"use client";

import type { Platform, Post } from "@/lib/types";
import { truncate } from "@/lib/format";

export type TileStatus = "idle" | "analyzing" | "done" | "error";

const PLATFORM_BG: Record<Platform, string> = {
  x: "#000000",
  threads: "#1c1c1c",
  youtube: "#cc0000",
  instagram: "linear-gradient(135deg, #f58529 0%, #dd2a7b 55%, #8134af 100%)",
};

export const PLATFORM_NAME: Record<Platform, string> = {
  x: "X",
  threads: "Threads",
  youtube: "YouTube",
  instagram: "Instagram",
};

interface Props {
  post: Post;
  status?: TileStatus;
  /** 타일 크기 — 모자이크(sm) / 패널·카드(md, lg) */
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  title?: string;
}

export default function PostTile({ post, status = "idle", size = "sm", onClick, title }: Props) {
  const isImg = Boolean(post.thumbnailUrl);
  const generated = Boolean(post.generated);
  const textLimit = size === "sm" ? 40 : size === "md" ? 90 : 220;
  const cls = [
    "relative block w-full overflow-hidden rounded-[3px] text-left text-white transition-opacity duration-200",
    "aspect-[16/10]",
    status === "done" ? "opacity-[0.72]" : "opacity-100",
    status === "analyzing" ? "ring-analyzing z-10" : "",
    onClick ? "cursor-pointer hover:opacity-100" : "",
  ].join(" ");

  const inner = (
    <>
      {isImg ? (
        // 외부 임의 URL 썸네일이라 next/image 최적화 대상이 아님
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumbnailUrl}
          alt={`${post.brand} 포스트 썸네일`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: PLATFORM_BG[post.platform] }}
          aria-hidden="true"
        />
      )}
      {!isImg && (
        <div
          className={[
            "absolute inset-0 flex flex-col justify-between",
            size === "sm" ? "p-[5px]" : size === "md" ? "p-2" : "p-3",
          ].join(" ")}
        >
          <div
            className={[
              "truncate font-mono uppercase tracking-[0.08em] text-white/70",
              size === "sm" ? "text-[6.5px] leading-none" : "text-[9px] leading-none",
              // "예시" 뱃지가 좌상단에 겹치지 않도록 브랜드 줄을 밀어 둠
              generated ? (size === "sm" ? "pl-[20px]" : "pl-[28px]") : "",
            ].join(" ")}
          >
            {post.brand}
          </div>
          <div
            className={[
              "font-medium text-white/95",
              size === "sm"
                ? "line-clamp-3 text-[7px] leading-[1.25]"
                : size === "md"
                  ? "line-clamp-4 text-[11px] leading-[1.35]"
                  : "line-clamp-6 text-[13px] leading-[1.45]",
            ].join(" ")}
          >
            {truncate(post.text, textLimit)}
          </div>
        </div>
      )}
      {isImg && (
        // 썸네일 위 하단 스크림 — 채널명이 읽히도록
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0) 100%)" }}
          aria-hidden="true"
        >
          <div
            className={[
              "truncate font-mono uppercase tracking-[0.08em] text-white/90",
              size === "sm" ? "px-[5px] pb-[4px] pt-3 text-[6.5px] leading-none" : "px-2 pb-1.5 pt-4 text-[9px] leading-none",
            ].join(" ")}
          >
            {post.brand}
          </div>
        </div>
      )}
      {generated && (
        <span
          className={[
            "absolute left-[3px] top-[3px] rounded-[2px] bg-white font-mono leading-none text-ink opacity-90",
            size === "sm" ? "px-[3px] py-[2px] text-[7px]" : "px-1 py-[2px] text-[8px]",
          ].join(" ")}
          aria-label="AI 생성 예시"
        >
          예시
        </span>
      )}
      {status === "done" && (
        <span
          className="absolute right-[3px] top-[3px] flex h-3 w-3 items-center justify-center rounded-full bg-ok text-[8px] font-bold text-white shadow-sm"
          aria-label="분석 완료"
        >
          ✓
        </span>
      )}
      {status === "error" && (
        <span
          className="absolute right-[3px] top-[3px] flex h-3 w-3 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white shadow-sm"
          aria-label="분석 실패"
        >
          !
        </span>
      )}
    </>
  );

  const label = title ?? `${post.brand} · ${PLATFORM_NAME[post.platform]} · ${truncate(post.text, 60)}`;

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={label} title={label}>
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} title={label} role="img" aria-label={label}>
      {inner}
    </div>
  );
}
