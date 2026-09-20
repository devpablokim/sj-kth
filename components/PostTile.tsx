/*
 * PostTile — 모자이크 한 칸. thumbnailUrl 이 있으면 이미지, 없으면 플랫폼 색 배경 위에
 * 브랜드 + 본문 앞 40자를 아주 작게 찍는 텍스트 타일. 상태(idle/analyzing/done/error)에 따라
 * 빨간 테두리 · 체크 뱃지 · 에러 뱃지를 표시합니다.
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
              "font-mono uppercase tracking-[0.08em] text-white/70",
              size === "sm" ? "text-[6.5px] leading-none" : "text-[9px] leading-none",
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
